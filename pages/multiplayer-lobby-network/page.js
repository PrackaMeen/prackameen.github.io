import { SessionManager } from "../../session/SessionManager.js";
import { loadPlayerPreferences } from "../../player-preferences.js";

const SIGNALING_URL_KEY = "game-signaling-server-url";

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
  const goChatBtn = document.getElementById("goToChatBtn");
  const goSettingsBtn = document.getElementById("goToSettingsBtn");

  const prefs = loadPlayerPreferences();
  const nickname = prefs.nickname || "Player";
  const mgr = new SessionManager();
  const unsubs = [];
  let scanStream = null;
  let scanFrameHandle = null;
  let scanDetector = null;

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

    let sessionId, signalingUrls;
    try {
      const parsed = parseJoinPayload(raw);
      sessionId = parsed.s;
      signalingUrls = normalizeSignalingUrls(parsed);
      if (!sessionId || signalingUrls.length === 0) throw new Error("incomplete");
    } catch {
      statusEl.textContent = "Invalid join code. Please check you copied it correctly.";
      statusEl.style.color = "#b91c1c";
      return;
    }

    // Save first candidate for next time
    localStorage.setItem(SIGNALING_URL_KEY, signalingUrls[0]);

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

    let lastError = null;
    for (let i = 0; i < signalingUrls.length; i += 1) {
      const signalingUrl = signalingUrls[i];
      statusEl.textContent = `Connecting to signaling server (${i + 1}/${signalingUrls.length})…`;
      try {
        await mgr.join({ sessionId, nickname, transportType: "webrtc", signalingUrl });
        localStorage.setItem(SIGNALING_URL_KEY, signalingUrl);
        return;
      } catch (err) {
        lastError = err;
      }
    }

    const triedHosts = signalingUrls.map((url) => {
      try {
        return new URL(url).host;
      } catch {
        return url;
      }
    }).join(", ");

    statusEl.textContent = `Error: ${lastError?.message || "Unable to connect using provided signaling options."} Tried: ${triedHosts}`;
    statusEl.style.color = "#b91c1c";
    joinBtn.disabled = false;
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
      stopScanner();
      unsubs.forEach(u => u?.());
      // mgr.leave() intentionally not called — session continues when navigating forward
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
    const parsed = parseJoinPayload(raw);
    if (parsed?.s && parsed?.u) {
      return raw;
    }
  } catch {
    // Not a join code.
  }

  return null;
}

function parseJoinPayload(rawJoinCode) {
  const normalized = String(rawJoinCode || "").trim();
  const payload = normalized.startsWith("GAMEJOIN:")
    ? normalized.slice("GAMEJOIN:".length).trim()
    : normalized;

  return JSON.parse(atob(payload));
}

function normalizeSignalingUrls(parsedPayload) {
  const AZURE_SIGNALING_URL = "wss://prackameen-game-d4gqengkdwggbgcd.westeurope-01.azurewebsites.net/multiplayer/signaling";
  const LOCAL_SIGNALING_URL = "ws://localhost:5000/multiplayer/signaling";
  const list = [];

  // Always prefer Azure, then join code, then local
  list.push(AZURE_SIGNALING_URL);

  if (parsedPayload && typeof parsedPayload.u === "string") {
    list.push(parsedPayload.u);
  }

  if (Array.isArray(parsedPayload?.us)) {
    for (const url of parsedPayload.us) {
      if (typeof url === "string") {
        list.push(url);
      }
    }
  }

  list.push(LOCAL_SIGNALING_URL);

  return dedupe(list.map((url) => String(url).trim()).filter(Boolean));
}

function dedupe(items) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    if (!seen.has(item)) {
      seen.add(item);
      result.push(item);
    }
  }
  return result;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
