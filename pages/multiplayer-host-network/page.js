import { SessionManager } from "../../session/SessionManager.js";
import { loadPlayerPreferences } from "../../player-preferences.js";

const SIGNALING_URL_KEY = "game-signaling-server-url";
const DEFAULT_SIGNALING_URL = "ws://localhost:5000/multiplayer/signaling";

export function mountPage(context) {
  context.setTitle("Multiplayer / Network Host");

  const statusEl = document.getElementById("hostStatus");
  const signalingUrlEl = document.getElementById("signalingUrl");
  const startBtn = document.getElementById("startBtn");
  const joinCodeCard = document.getElementById("joinCodeCard");
  const joinCodeEl = document.getElementById("joinCode");
  const copyJoinCodeBtn = document.getElementById("copyJoinCodeBtn");
  const peersCard = document.getElementById("peersCard");
  const peerListEl = document.getElementById("peerList");
  const peerCountEl = document.getElementById("peerCount");
  const actionsCard = document.getElementById("actionsCard");
  const goChatBtn = document.getElementById("goToChatBtn");
  const goSettingsBtn = document.getElementById("goToSettingsBtn");

  // Pre-fill saved signaling URL
  signalingUrlEl.value = localStorage.getItem(SIGNALING_URL_KEY) || DEFAULT_SIGNALING_URL;

  const prefs = loadPlayerPreferences();
  const nickname = prefs.nickname || "Host";
  const mgr = new SessionManager();
  const unsubs = [];

  // ── peer rendering ────────────────────────────────────────────────────────

  function renderPeers(peers) {
    peerCountEl.textContent = `(${peers.length})`;
    const hasEnough = peers.length >= 2;
    goChatBtn.disabled = !hasEnough;
    goSettingsBtn.disabled = !hasEnough;

    if (peers.length === 0) {
      peerListEl.innerHTML = '<li class="peer-item peer-item--empty">Waiting for players…</li>';
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

  // ── start session ─────────────────────────────────────────────────────────

  startBtn.addEventListener("click", async () => {
    const signalingUrl = signalingUrlEl.value.trim();
    if (!signalingUrl) {
      statusEl.textContent = "Please enter the signaling server URL.";
      return;
    }

    localStorage.setItem(SIGNALING_URL_KEY, signalingUrl);
    startBtn.disabled = true;
    statusEl.textContent = "Connecting to signaling server…";
    statusEl.style.color = "";

    try {
      await mgr.create({ nickname, transportType: "webrtc", signalingUrl });
    } catch (err) {
      statusEl.textContent = `Error: ${err.message}`;
      statusEl.style.color = "#b91c1c";
      startBtn.disabled = false;
      return;
    }

    // Build and display the join code (base64 of { s: sessionId, u: signalingUrl })
    const joinCode = btoa(JSON.stringify({ s: mgr.sessionId, u: signalingUrl }));
    joinCodeEl.value = joinCode;
    joinCodeCard.hidden = false;
    peersCard.hidden = false;
    actionsCard.hidden = false;

    statusEl.textContent = "Session active — share the Join Code with players.";

    unsubs.push(mgr.peers.onChange(renderPeers));
    renderPeers(mgr.peers.getAll());
  });

  // ── copy join code ────────────────────────────────────────────────────────

  copyJoinCodeBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(joinCodeEl.value).then(() => {
      copyJoinCodeBtn.textContent = "Copied!";
      setTimeout(() => { copyJoinCodeBtn.textContent = "Copy Join Code"; }, 1500);
    });
  });

  // ── proceed ───────────────────────────────────────────────────────────────

  goChatBtn.addEventListener("click", () => {
    window.__GAME_MULTIPLAYER_SESSION__ = mgr;
    context.setRoute("multiplayer-chat");
  });

  goSettingsBtn.addEventListener("click", () => {
    window.__GAME_MULTIPLAYER_SESSION__ = mgr;
    context.setRoute("multiplayer-host-game-settings");
  });

  // ── dispose ───────────────────────────────────────────────────────────────

  return {
    dispose() {
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
