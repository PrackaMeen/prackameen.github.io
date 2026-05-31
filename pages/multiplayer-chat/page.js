/**
 * multiplayer-chat/page.js
 *
 * Can be reached in two ways:
 *
 * 1. Navigated from multiplayer-host or multiplayer-lobby:
 *    window.__GAME_MULTIPLAYER_SESSION__ holds the active SessionManager.
 *    No URL params needed — the session is already running.
 *
 * 2. Direct URL access (dev, standalone tabs):
 *    #/multiplayer-chat?host=1&name=Alice          → creates a new host session
 *    #/multiplayer-chat?session=<id>&name=Bob      → joins an existing session
 */

import { SessionManager } from "../../session/SessionManager.js";
import { loadPlayerPreferences } from "../../player-preferences.js";

export function mountPage(context) {
  context.setTitle("Multiplayer / Chat");

  const statusEl = document.getElementById("sessionStatus");
  const sessionIdEl = document.getElementById("sessionIdDisplay");
  const copyBtn = document.getElementById("copySessionIdBtn");
  const roleEl = document.getElementById("sessionRole");
  const peerListEl = document.getElementById("peerList");
  const peerCountEl = document.getElementById("peerCount");
  const messageLogEl = document.getElementById("messageLog");
  const chatForm = document.getElementById("chatForm");
  const chatInput = document.getElementById("chatInput");
  const sendBtn = chatForm.querySelector(".chat-send-btn");

  const prefs = loadPlayerPreferences();
  const params = parseParams();
  const nickname = params.name || prefs.nickname || "Player";

  // Use pre-existing session if navigated from host/lobby, else create one here.
  const handedOffMgr = window.__GAME_MULTIPLAYER_SESSION__ || null;
  window.__GAME_MULTIPLAYER_SESSION__ = null;

  const mgr = handedOffMgr || new SessionManager();
  const ownsMgr = !handedOffMgr; // only leave() if we created it
  const unsubs = [];

  // ── peer list rendering ───────────────────────────────────────────────────

  function renderPeers(peers) {
    peerCountEl.textContent = `(${peers.length})`;
    if (peers.length === 0) {
      peerListEl.innerHTML = '<li class="peer-item peer-item--empty">No peers yet.</li>';
      return;
    }
    peerListEl.innerHTML = peers.map((p) => {
      const badgeClass = p.isHost ? "peer-badge peer-badge--host" : "peer-badge";
      const label = p.isHost ? "Host" : "Peer";
      return `
        <li class="peer-item">
          <span>${escHtml(p.nickname || p.peerId.slice(0, 8))}</span>
          <span class="${badgeClass}">${label}</span>
        </li>`;
    }).join("");
  }

  // ── message rendering ─────────────────────────────────────────────────────

  function appendMessage(envelope) {
    const isSelf = envelope.senderId === mgr.peerId;
    const isSystem = envelope.type === "system";
    const peer = mgr.peers.get(envelope.senderId);
    const senderName = peer ? (peer.nickname || envelope.senderId.slice(0, 8)) : envelope.senderId.slice(0, 8);
    const time = new Date(envelope.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

    const li = document.createElement("li");
    li.className = [
      "message-item",
      isSelf ? "message-item--self" : "",
      isSystem ? "message-item--system" : ""
    ].filter(Boolean).join(" ");

    li.innerHTML = `
      <span class="message-seq">#${envelope.seq}</span>
      <span class="message-sender">${escHtml(senderName)}</span>
      <span class="message-text">${escHtml(envelope.payload?.text ?? JSON.stringify(envelope.payload))}</span>
      <span class="message-ts">${time}</span>`;

    messageLogEl.appendChild(li);
    messageLogEl.scrollTop = messageLogEl.scrollHeight;
  }

  // ── session wiring (works for both handed-off and freshly created mgr) ────

  function wireSession() {
    unsubs.push(mgr.peers.onChange(renderPeers));

    const unsub = mgr.onMessage((envelope) => {
      if (envelope.type === "chat" || envelope.type === "system") {
        appendMessage(envelope);
      }
    });
    unsubs.push(unsub);

    mgr.onDisconnected(() => {
      statusEl.textContent = "Disconnected.";
      sendBtn.disabled = true;
    });
  }

  // ── init ──────────────────────────────────────────────────────────────────

  sendBtn.disabled = true;

  if (handedOffMgr) {
    // Session already running — plug straight in.
    const isHost = mgr._transport && mgr._transport.isHost;
    statusEl.textContent = isHost ? "Session active — waiting for peers." : "Connected to session.";
    sessionIdEl.textContent = mgr.sessionId || "—";
    roleEl.textContent = isHost ? "Host" : "Client";
    sendBtn.disabled = false;
    renderPeers(mgr.peers.getAll());
    wireSession();
  } else {
    // Fresh start from URL params.
    const isHost = params.host === "1" || params.host === "true";
    const sessionIdParam = params.session || null;

    mgr.onSessionReady(({ sessionId, isHost: host }) => {
      statusEl.textContent = host ? "Session active — waiting for peers." : "Joined session.";
      sessionIdEl.textContent = sessionId;
      roleEl.textContent = host ? "Host" : "Client";
      sendBtn.disabled = false;
      renderPeers(mgr.peers.getAll());
    });

    wireSession();

    async function start() {
      try {
        if (isHost) {
          await mgr.create({ nickname, transportType: "broadcast" });
        } else if (sessionIdParam) {
          await mgr.join({ sessionId: sessionIdParam, nickname, transportType: "broadcast" });
        } else {
          statusEl.textContent = "No session. Use ?host=1 or ?session=<id>, or navigate here from Host/Lobby.";
          return;
        }
      } catch (err) {
        statusEl.textContent = `Error: ${err.message}`;
        statusEl.style.color = "#b91c1c";
      }
    }

    start();
  }

  // ── copy session ID ───────────────────────────────────────────────────────

  copyBtn.addEventListener("click", () => {
    const id = sessionIdEl.textContent;
    if (id && id !== "—") {
      navigator.clipboard.writeText(id).then(() => {
        copyBtn.textContent = "Copied!";
        setTimeout(() => { copyBtn.textContent = "Copy"; }, 1500);
      });
    }
  });

  // ── send chat ─────────────────────────────────────────────────────────────

  chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (!text) return;
    chatInput.value = "";
    try {
      await mgr.send("chat", { text });
    } catch (err) {
      statusEl.textContent = `Send error: ${err.message}`;
    }
  });

  // ── dispose ───────────────────────────────────────────────────────────────

  return {
    async dispose() {
      unsubs.forEach(u => u && u());
      if (ownsMgr) {
        await mgr.leave();
      }
    }
  };
}

// ── helpers ───────────────────────────────────────────────────────────────

function parseParams() {
  // Support params in the hash: #/multiplayer-chat?key=value
  const hash = window.location.hash || "";
  const qIndex = hash.indexOf("?");
  if (qIndex === -1) return {};
  const qs = hash.slice(qIndex + 1);
  return Object.fromEntries(new URLSearchParams(qs));
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
