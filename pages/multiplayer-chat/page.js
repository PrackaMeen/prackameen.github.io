/**
 * multiplayer-chat/page.js
 *
 * Test page for the full session pipeline.
 * Reads ?host=1&session=<id>&name=<nickname> from the URL hash or query string.
 *
 * Examples (same origin, 3 tabs):
 *   Tab 1 (host):   #/multiplayer-chat?host=1&name=Alice
 *   Tab 2 (client): #/multiplayer-chat?session=<id>&name=Bob
 *   Tab 3 (client): #/multiplayer-chat?session=<id>&name=Carol
 *
 * After host tab loads, copy the session ID shown and paste into client tabs.
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
  const isHost = params.host === "1" || params.host === "true";
  const sessionIdParam = params.session || null;
  const nickname = params.name || prefs.nickname || "Player";

  const mgr = new SessionManager();
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

  // ── session setup ─────────────────────────────────────────────────────────

  mgr.onSessionReady(({ sessionId, isHost: host }) => {
    statusEl.textContent = host ? "Session active — waiting for peers." : "Joined session.";
    sessionIdEl.textContent = sessionId;
    roleEl.textContent = host ? "Host" : "Client";
    sendBtn.disabled = false;

    // Render initial peer list
    renderPeers(mgr.peers.getAll());
  });

  unsubs.push(mgr.peers.onChange(renderPeers));

  mgr.onDisconnected(() => {
    statusEl.textContent = "Disconnected.";
    sendBtn.disabled = true;
  });

  mgr.onReconnecting && mgr.onReconnecting(() => {
    statusEl.textContent = "Reconnecting and syncing history…";
  });

  // ── init ──────────────────────────────────────────────────────────────────

  sendBtn.disabled = true;

  async function start() {
    try {
      if (isHost) {
        await mgr.create({ nickname, transportType: "broadcast" });
      } else if (sessionIdParam) {
        await mgr.join({ sessionId: sessionIdParam, nickname, transportType: "broadcast" });
      } else {
        statusEl.textContent = "Provide ?host=1 or ?session=<id> in the URL.";
        return;
      }

      // Subscribe to ordered messages from the bus
      const unsub = mgr.onMessage((envelope) => {
        if (envelope.type === "chat" || envelope.type === "system") {
          appendMessage(envelope);
        }
      });
      unsubs.push(unsub);
    } catch (err) {
      statusEl.textContent = `Error: ${err.message}`;
    }
  }

  start();

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
      await mgr.leave();
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
