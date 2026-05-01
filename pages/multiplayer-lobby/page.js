import { SessionManager } from "../../session/SessionManager.js";
import { mountSessionChat } from "../../session/SessionChat.js";
import { loadPlayerPreferences } from "../../player-preferences.js";

export function mountPage(context) {
  context.setTitle("Multiplayer / Lobby");

  const statusEl = document.getElementById("lobbyStatus");
  const joinForm = document.getElementById("joinForm");
  const sessionIdInput = document.getElementById("sessionIdInput");
  const joinBtn = document.getElementById("joinBtn");
  const peersCard = document.getElementById("peersCard");
  const settingsCard = document.getElementById("settingsCard");
  const peerListEl = document.getElementById("peerList");
  const peerCountEl = document.getElementById("peerCount");
  const goBtn = document.getElementById("goToSettingsBtn");
  const chatCardEl = document.getElementById("chatCard");
  const messageLogEl = document.getElementById("messageLog");
  const chatForm = document.getElementById("chatForm");
  const chatInput = document.getElementById("chatInput");

  const prefs = loadPlayerPreferences();
  const nickname = prefs.nickname || "Player";
  const mgr = new SessionManager();
  const unsubs = [];
  let chatController = null;

  function renderPeers(peers) {
    peerCountEl.textContent = `(${peers.length})`;
    if (peers.length === 0) {
      peerListEl.innerHTML = '<li class="peer-item peer-item--empty">Connecting…</li>';
      return;
    }
    peerListEl.innerHTML = peers.map((p) => {
      const badgeClass = p.isHost ? "peer-badge peer-badge--host" : "peer-badge";
      return `<li class="peer-item"><span>${escHtml(p.nickname || p.peerId.slice(0, 8))}</span><span class="${badgeClass}">${p.isHost ? "Host" : "Peer"}</span></li>`;
    }).join("");
  }

  unsubs.push(mgr.peers.onChange(renderPeers));

  joinForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const sessionId = sessionIdInput.value.trim();
    if (!sessionId) return;
    joinBtn.disabled = true;
    statusEl.textContent = "Joining… (waiting for host, up to 15 s)";
    statusEl.style.color = "";
    try {
      await mgr.join({ sessionId, nickname, transportType: "broadcast" });
      statusEl.textContent = "Connected to session.";
      joinForm.hidden = true;
      peersCard.hidden = false;
      settingsCard.hidden = false;
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
      statusEl.textContent = `Could not join: ${err.message}`;
      statusEl.style.color = "#b91c1c";
      joinBtn.disabled = false;
    }
  });

  goBtn.addEventListener("click", () => {
    window.__GAME_MULTIPLAYER_SESSION__ = mgr;
    context.setRoute("multiplayer-lobby-joined-game-settings");
  });

  return {
    async dispose() {
      unsubs.forEach(u => u && u());
      chatController && chatController.dispose();
    }
  };
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
