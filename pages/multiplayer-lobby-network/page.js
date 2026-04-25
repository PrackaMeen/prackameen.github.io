import { SessionManager } from "../../session/SessionManager.js";
import { loadPlayerPreferences } from "../../player-preferences.js";

const SIGNALING_URL_KEY = "game-signaling-server-url";

export function mountPage(context) {
  context.setTitle("Multiplayer / Network Join");

  const statusEl = document.getElementById("joinStatus");
  const joinForm = document.getElementById("joinForm");
  const joinCodeInputEl = document.getElementById("joinCodeInput");
  const joinBtn = document.getElementById("joinBtn");
  const peersCard = document.getElementById("peersCard");
  const peerListEl = document.getElementById("peerList");
  const peerCountEl = document.getElementById("peerCount");
  const actionsCard = document.getElementById("actionsCard");
  const goChatBtn = document.getElementById("goToChatBtn");
  const goSettingsBtn = document.getElementById("goToSettingsBtn");

  const prefs = loadPlayerPreferences();
  const nickname = prefs.nickname || "Player";
  const mgr = new SessionManager();
  const unsubs = [];

  // ── peer rendering ────────────────────────────────────────────────────────

  function renderPeers(peers) {
    peerCountEl.textContent = `(${peers.length})`;
    const hasEnough = peers.length >= 2;
    goChatBtn.disabled = !hasEnough;
    goSettingsBtn.disabled = !hasEnough;

    if (peers.length === 0) {
      peerListEl.innerHTML = '<li class="peer-item peer-item--empty">No peers yet.</li>';
      return;
    }
    peerListEl.innerHTML = peers.map((p) => {
      const cls = p.isHost ? "peer-badge peer-badge--host" : "peer-badge";
      return `<li class="peer-item">
        <span>${escHtml(p.nickname || p.peerId.slice(0, 8))}</span>
        <span class="${cls}">${p.isHost ? "Host" : "Peer"}</span>
      </li>`;
    }).join("");
  }

  // ── join ──────────────────────────────────────────────────────────────────

  joinForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const raw = joinCodeInputEl.value.trim();
    if (!raw) return;

    let sessionId, signalingUrl;
    try {
      const parsed = JSON.parse(atob(raw));
      sessionId = parsed.s;
      signalingUrl = parsed.u;
      if (!sessionId || !signalingUrl) throw new Error("incomplete");
    } catch {
      statusEl.textContent = "Invalid join code. Please check you copied it correctly.";
      statusEl.style.color = "#b91c1c";
      return;
    }

    // Save signaling URL for next time
    localStorage.setItem(SIGNALING_URL_KEY, signalingUrl);

    joinBtn.disabled = true;
    statusEl.textContent = "Connecting to signaling server…";
    statusEl.style.color = "";

    mgr.onSessionReady(({ sessionId: sid }) => {
      statusEl.textContent = `Connected to session.`;
      peersCard.hidden = false;
      actionsCard.hidden = false;
      renderPeers(mgr.peers.getAll());
    });

    unsubs.push(mgr.peers.onChange(renderPeers));

    mgr.onDisconnected(() => {
      statusEl.textContent = "Disconnected from session.";
    });

    try {
      await mgr.join({ sessionId, nickname, transportType: "webrtc", signalingUrl });
    } catch (err) {
      statusEl.textContent = `Error: ${err.message}`;
      statusEl.style.color = "#b91c1c";
      joinBtn.disabled = false;
    }
  });

  // ── proceed ───────────────────────────────────────────────────────────────

  goChatBtn.addEventListener("click", () => {
    window.__GAME_MULTIPLAYER_SESSION__ = mgr;
    context.setRoute("multiplayer-chat");
  });

  goSettingsBtn.addEventListener("click", () => {
    window.__GAME_MULTIPLAYER_SESSION__ = mgr;
    context.setRoute("multiplayer-lobby-joined-game-settings");
  });

  // ── dispose ───────────────────────────────────────────────────────────────

  return {
    async dispose() {
      unsubs.forEach(u => u?.());
      // mgr.leave() intentionally not called — session continues when navigating forward
    }
  };
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
