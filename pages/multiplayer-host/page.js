import { SessionManager } from "../../session/SessionManager.js";
import { mountSessionChat } from "../../session/SessionChat.js";
import { loadPlayerPreferences } from "../../player-preferences.js";

export function mountPage(context) {
  context.setTitle("Multiplayer / Host");

  const statusEl = document.getElementById("hostStatus");
  const sessionIdEl = document.getElementById("hostSessionId");
  const copyBtn = document.getElementById("copySessionIdBtn");
  const peerListEl = document.getElementById("peerList");
  const peerCountEl = document.getElementById("peerCount");
  const goBtn = document.getElementById("goToSettingsBtn");
  const chatCardEl = document.getElementById("chatCard");
  const messageLogEl = document.getElementById("messageLog");
  const chatForm = document.getElementById("chatForm");
  const chatInput = document.getElementById("chatInput");

  const prefs = loadPlayerPreferences();
  const nickname = prefs.nickname || "Host";
  const mgr = new SessionManager();
  const unsubs = [];
  let chatController = null;

  function renderPeers(peers) {
    peerCountEl.textContent = `(${peers.length})`;
    goBtn.disabled = peers.length < 2;
    if (peers.length === 0) {
      peerListEl.innerHTML = '<li class="peer-item peer-item--empty">Waiting for players…</li>';
      return;
    }
    peerListEl.innerHTML = peers.map((p) => {
      const badgeClass = p.isHost ? "peer-badge peer-badge--host" : "peer-badge";
      return `<li class="peer-item"><span>${escHtml(p.nickname || p.peerId.slice(0, 8))}</span><span class="${badgeClass}">${p.isHost ? "Host" : "Peer"}</span></li>`;
    }).join("");
  }

  unsubs.push(mgr.peers.onChange(renderPeers));

  copyBtn.addEventListener("click", () => {
    const id = sessionIdEl.textContent;
    if (id && id !== "—") {
      navigator.clipboard.writeText(id).then(() => {
        copyBtn.textContent = "Copied!";
        setTimeout(() => { copyBtn.textContent = "Copy"; }, 1500);
      });
    }
  });

  goBtn.addEventListener("click", () => {
    window.__GAME_MULTIPLAYER_SESSION__ = mgr;
    context.setRoute("multiplayer-host-game-settings");
  });

  void startSession();

  async function startSession() {
    try {
      const sessionId = await mgr.create({ nickname, transportType: "broadcast" });
      statusEl.textContent = "Session active — share the ID below.";
      sessionIdEl.textContent = sessionId;
      renderPeers(mgr.peers.getAll());
      if (!chatController) {
        chatController = mountSessionChat({
          mgr,
          statusEl,
          chatCardEl,
          messageLogEl,
          chatForm,
          chatInput
        });
      }
    } catch (err) {
      statusEl.textContent = `Error: ${err.message}`;
    }
  }

  return {
    async dispose() {
      unsubs.forEach(u => u && u());
      chatController && chatController.dispose();
      // mgr.leave() is intentionally NOT called here — session continues
      // when navigating to game settings.
    }
  };
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
