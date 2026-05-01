import { RoomApiClient, buildRoomJoinCode, loadStoredApiBaseUrl } from "../../session/RoomApiClient.js";
import { loadPlayerPreferences } from "../../player-preferences.js";

const DEFAULT_API_BASE_URL = "https://prackameen-game-d4gqengkdwggbgcd.westeurope-01.azurewebsites.net/api";
const HEARTBEAT_INTERVAL_MS = 15_000;
const POLL_INTERVAL_MS = 4_000;

export function mountPage(context) {
  context.setTitle("Multiplayer / Network Host");

  const statusEl = document.getElementById("hostStatus");
  const apiBaseUrlEl = document.getElementById("apiBaseUrl");
  const startBtn = document.getElementById("startBtn");
  const joinCodeCard = document.getElementById("joinCodeCard");
  const joinCodeEl = document.getElementById("joinCode");
  const copyJoinCodeBtn = document.getElementById("copyJoinCodeBtn");
  const qrCodeCard = document.getElementById("qrCodeCard");
  const qrCodeContainer = document.getElementById("qrCodeContainer");
  const peersCard = document.getElementById("peersCard");
  const peerListEl = document.getElementById("peerList");
  const peerCountEl = document.getElementById("peerCount");
  const actionsCard = document.getElementById("actionsCard");
  const goSettingsBtn = document.getElementById("goToSettingsBtn");

  const roomApi = new RoomApiClient(loadStoredApiBaseUrl() || DEFAULT_API_BASE_URL);
  apiBaseUrlEl.value = roomApi.apiBaseUrl;
  document.getElementById("goToChatBtn").hidden = true;
  goSettingsBtn.disabled = true;

  const prefs = loadPlayerPreferences();
  const nickname = prefs.nickname || "Host";
  let activeRoomId = "";
  let activePlayerId = "";
  let heartbeatTimer = null;
  let pollTimer = null;

  // ── peer rendering ────────────────────────────────────────────────────────

  function renderPeers(peers) {
    peerCountEl.textContent = `(${peers.length})`;
    goSettingsBtn.disabled = peers.length < 2;

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
    const apiBaseUrl = apiBaseUrlEl.value.trim();
    if (!apiBaseUrl) {
      statusEl.textContent = "Please enter the backend API base URL.";
      return;
    }

    try {
      roomApi.setApiBaseUrl(apiBaseUrl);
    } catch (err) {
      statusEl.textContent = `Error: ${err.message}`;
      statusEl.style.color = "#b91c1c";
      return;
    }

    startBtn.disabled = true;
    statusEl.textContent = "Creating room…";
    statusEl.style.color = "";

    try {
      const snapshot = await roomApi.createRoom(nickname);
      activeRoomId = snapshot.roomId;
      activePlayerId = snapshot.hostPlayerId;

      const joinCode = buildRoomJoinCode({ roomId: snapshot.roomId, apiBaseUrl: roomApi.apiBaseUrl });
      joinCodeEl.value = joinCode;
      joinCodeCard.hidden = false;
      peersCard.hidden = false;
      actionsCard.hidden = false;

      generateQRCode(qrCodeContainer, `GAMEJOIN:${joinCode}`);
      qrCodeCard.hidden = false;

      renderRoomSnapshot(snapshot);
      startPollingRoom();
      startHeartbeat();
    } catch (err) {
      statusEl.textContent = `Error: ${err.message}`;
      statusEl.style.color = "#b91c1c";
      startBtn.disabled = false;
      return;
    }
  });

  // ── copy join code ────────────────────────────────────────────────────────

  copyJoinCodeBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(joinCodeEl.value).then(() => {
      copyJoinCodeBtn.textContent = "Copied!";
      setTimeout(() => { copyJoinCodeBtn.textContent = "Copy Join Code"; }, 1500);
    });
  });

  // ── proceed ───────────────────────────────────────────────────────────────

  goSettingsBtn.addEventListener("click", () => {
    context.setRoute("multiplayer-host-game-settings");
  });

  // ── dispose ───────────────────────────────────────────────────────────────

  return {
    dispose() {
      stopTimers();
    }
  };

  function renderRoomSnapshot(snapshot) {
    renderPeers(snapshot?.players || []);
    if (!snapshot) {
      return;
    }

    statusEl.textContent = `Room ${snapshot.roomId} is ${snapshot.status || "waiting"} · state v${snapshot.stateVersion || 0}`;
    statusEl.style.color = "";
  }

  function startPollingRoom() {
    stopPollingRoom();
    if (!activeRoomId) {
      return;
    }

    const refreshRoom = async () => {
      try {
        const snapshot = await roomApi.getRoom(activeRoomId);
        renderRoomSnapshot(snapshot);
      } catch (err) {
        statusEl.textContent = `Room refresh failed: ${err.message}`;
        statusEl.style.color = "#b91c1c";
      }
    };

    refreshRoom();
    pollTimer = window.setInterval(refreshRoom, POLL_INTERVAL_MS);
  }

  function stopPollingRoom() {
    if (pollTimer) {
      window.clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  function startHeartbeat() {
    stopHeartbeat();
    if (!activeRoomId || !activePlayerId) {
      return;
    }

    const sendHeartbeat = async () => {
      try {
        const snapshot = await roomApi.heartbeat(activeRoomId, activePlayerId);
        renderRoomSnapshot(snapshot);
      } catch (err) {
        statusEl.textContent = `Room heartbeat failed: ${err.message}`;
        statusEl.style.color = "#b91c1c";
      }
    };

    sendHeartbeat();
    heartbeatTimer = window.setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
  }

  function stopHeartbeat() {
    if (heartbeatTimer) {
      window.clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }

  function stopTimers() {
    stopPollingRoom();
    stopHeartbeat();
  }
}

function generateQRCode(container, text) {
  container.innerHTML = "";

  // Use reliable QR code API - qr-server.com
  const encodedText = encodeURIComponent(text);
  const apiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodedText}`;

  const img = document.createElement("img");
  img.src = apiUrl;
  img.alt = "QR Code for joining session";
  img.style.border = "2px solid #d1d5db";
  img.style.borderRadius = "0.375rem";
  img.style.maxWidth = "100%";
  img.style.height = "auto";
  
  img.onerror = function() {
    container.innerHTML = '<p style="color:#666; font-size:0.85rem; margin:0;">Unable to generate QR code. Use the Join Code above instead.</p>';
  };

  container.appendChild(img);
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

