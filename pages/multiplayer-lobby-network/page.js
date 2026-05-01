import { RoomApiClient, loadStoredApiBaseUrl, parseRoomJoinCode } from "../../session/RoomApiClient.js";
import { loadPlayerPreferences } from "../../player-preferences.js";

const DEFAULT_API_BASE_URL = "https://prackameen-game-d4gqengkdwggbgcd.westeurope-01.azurewebsites.net/api";
const HEARTBEAT_INTERVAL_MS = 15_000;
const POLL_INTERVAL_MS = 4_000;

export function mountPage(context) {
  context.setTitle("Multiplayer / Network Join");

  const statusEl = document.getElementById("joinStatus");
  const joinForm = document.getElementById("joinForm");
  const joinCodeInputEl = document.getElementById("joinCodeInput");
  const joinBtn = document.getElementById("joinBtn");
  const scanQrBtn = document.getElementById("scanQrBtn");
  const stopScanBtn = document.getElementById("stopScanBtn");
  const scannerCard = document.getElementById("scannerCard");
  const scannerVideo = document.getElementById("scannerVideo");
  const scannerStatus = document.getElementById("scannerStatus");
  const peersCard = document.getElementById("peersCard");
  const peerListEl = document.getElementById("peerList");
  const peerCountEl = document.getElementById("peerCount");
  const actionsCard = document.getElementById("actionsCard");
  const goSettingsBtn = document.getElementById("goToSettingsBtn");

  const prefs = loadPlayerPreferences();
  const nickname = prefs.nickname || "Player";
  const roomApi = new RoomApiClient(loadStoredApiBaseUrl() || DEFAULT_API_BASE_URL);
  const unsubs = [];
  let scanStream = null;
  let scanFrameHandle = null;
  let scanDetector = null;
  let pollTimer = null;
  let heartbeatTimer = null;
  let activeRoomId = "";
  let activePlayerId = "";

  document.getElementById("goToChatBtn").hidden = true;

  // ── auto-fill from QR code URL param ──────────────────────────────────────

  const urlParams = new URLSearchParams(window.location.search);
  const codeFromUrl = urlParams.get("code");
  if (codeFromUrl) {
    joinCodeInputEl.value = decodeURIComponent(codeFromUrl);
  }

  // ── in-app QR scanning ───────────────────────────────────────────────────

  if (scanQrBtn) {
    scanQrBtn.addEventListener("click", async () => {
      await startScanner();
    });
  }

  if (stopScanBtn) {
    stopScanBtn.addEventListener("click", () => {
      stopScanner();
    });
  }

  // ── peer rendering ────────────────────────────────────────────────────────

  function renderPeers(peers) {
    peerCountEl.textContent = `(${peers.length})`;
    goSettingsBtn.disabled = peers.length < 2;

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

    let roomId;
    let apiBaseUrl = "";
    try {
      const parsed = parseRoomJoinCode(raw);
      roomId = parsed.roomId;
      apiBaseUrl = parsed.apiBaseUrl || roomApi.apiBaseUrl;
      if (!roomId) throw new Error("incomplete");
    } catch {
      statusEl.textContent = "Invalid join code. Please check you copied it correctly.";
      statusEl.style.color = "#b91c1c";
      return;
    }

    try {
      roomApi.setApiBaseUrl(apiBaseUrl);
    } catch (err) {
      statusEl.textContent = `Error: ${err.message}`;
      statusEl.style.color = "#b91c1c";
      return;
    }

    joinBtn.disabled = true;
    statusEl.textContent = "Joining room…";
    statusEl.style.color = "";

    try {
      const snapshot = await roomApi.joinRoom(roomId, nickname);
      activeRoomId = snapshot.roomId;
      activePlayerId = pickLatestPlayerId(snapshot.players || []);
      peersCard.hidden = false;
      actionsCard.hidden = false;
      renderRoomSnapshot(snapshot);
      statusEl.textContent = `Joined room ${snapshot.roomId}.`;
      startPollingRoom();
      startHeartbeat();
    } catch (err) {
      statusEl.textContent = `Error: ${err.message}`;
      statusEl.style.color = "#b91c1c";
      joinBtn.disabled = false;
    }
  });

  // ── proceed ───────────────────────────────────────────────────────────────

  goSettingsBtn.addEventListener("click", () => {
    context.setRoute("multiplayer-lobby-joined-game-settings");
  });

  // ── dispose ───────────────────────────────────────────────────────────────

  return {
    async dispose() {
      stopTimers();
      stopScanner();
      unsubs.forEach(u => u?.());
    }
  };

  async function startScanner() {
    if (!supportsQrScanning()) {
      statusEl.textContent = "In-app QR scanning is not supported on this device/browser. Paste Join Code instead.";
      statusEl.style.color = "#b91c1c";
      return;
    }

    try {
      scanStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false
      });
      scannerVideo.srcObject = scanStream;
      scanDetector = new BarcodeDetector({ formats: ["qr_code"] });
      scannerCard.hidden = false;
      scanQrBtn.disabled = true;
      scannerStatus.textContent = "Scanning...";
      scannerStatus.style.color = "";
      runScanLoop();
    } catch (err) {
      statusEl.textContent = `Unable to start camera: ${err.message}`;
      statusEl.style.color = "#b91c1c";
      stopScanner();
    }
  }

  function stopScanner() {
    if (scanFrameHandle) {
      cancelAnimationFrame(scanFrameHandle);
      scanFrameHandle = null;
    }

    if (scanStream) {
      for (const track of scanStream.getTracks()) {
        track.stop();
      }
      scanStream = null;
    }

    if (scannerVideo) {
      scannerVideo.srcObject = null;
    }

    if (scannerCard) {
      scannerCard.hidden = true;
    }

    if (scanQrBtn) {
      scanQrBtn.disabled = false;
    }
  }

  async function runScanLoop() {
    if (!scanDetector || !scannerVideo || scannerVideo.readyState < 2) {
      scanFrameHandle = requestAnimationFrame(runScanLoop);
      return;
    }

    try {
      const barcodes = await scanDetector.detect(scannerVideo);
      if (barcodes.length > 0) {
        const rawValue = barcodes[0].rawValue || "";
        const joinCode = extractJoinCode(rawValue);

        if (joinCode) {
          joinCodeInputEl.value = joinCode;
          scannerStatus.textContent = "QR scanned. Join code filled.";
          scannerStatus.style.color = "#15803d";
          stopScanner();
          return;
        }

        scannerStatus.textContent = "QR detected, but format is not recognized for this app.";
        scannerStatus.style.color = "#b91c1c";
      }
    } catch {
      // Keep scanning; transient detector errors are common on camera startup.
    }

    scanFrameHandle = requestAnimationFrame(runScanLoop);
  }
}

function supportsQrScanning() {
  return !!(window.isSecureContext && navigator.mediaDevices?.getUserMedia && window.BarcodeDetector);
}

function extractJoinCode(scannedValue) {
  const raw = String(scannedValue || "").trim();
  if (!raw) {
    return null;
  }

  if (raw.startsWith("GAMEJOIN:")) {
    return raw.slice("GAMEJOIN:".length).trim() || null;
  }

  try {
    const parsedUrl = new URL(raw);
    const urlCode = parsedUrl.searchParams.get("code");
    if (urlCode) {
      return decodeURIComponent(urlCode);
    }
  } catch {
    // Not a URL; continue.
  }

  try {
    const parsed = parseRoomJoinCode(raw);
    if (parsed?.roomId) {
      return raw;
    }
  } catch {
    // Not a join code.
  }

  return null;
}

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

function pickLatestPlayerId(players) {
  for (let index = players.length - 1; index >= 0; index -= 1) {
    if (!players[index]?.isHost) {
      return players[index].playerId || "";
    }
  }

  return "";
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
