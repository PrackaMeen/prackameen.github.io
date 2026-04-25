import { SessionManager } from "../../session/SessionManager.js";
import { loadPlayerPreferences } from "../../player-preferences.js";

const SIGNALING_URL_KEY = "game-signaling-server-url";
const AZURE_SIGNALING_URL = "wss://prackameen-game-d4gqengkdwggbgcd.westeurope-01.azurewebsites.net/multiplayer/signaling";
const LOCAL_SIGNALING_URL = "ws://localhost:5000/multiplayer/signaling";
const DEFAULT_SIGNALING_URL = AZURE_SIGNALING_URL;

export function mountPage(context) {
  context.setTitle("Multiplayer / Network Host");

  const statusEl = document.getElementById("hostStatus");
  const signalingUrlEl = document.getElementById("signalingUrl");
  const extraHostInputEl = document.getElementById("extraHostInput");
  const localLanHostDisplayEl = document.getElementById("localLanHostDisplay");
  const localLanHostHintEl = document.getElementById("localLanHostHint");
  const copyLocalLanHostBtn = document.getElementById("copyLocalLanHostBtn");
  const useLocalLanHostBtn = document.getElementById("useLocalLanHostBtn");
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
  const goChatBtn = document.getElementById("goToChatBtn");
  const goSettingsBtn = document.getElementById("goToSettingsBtn");

  // Pre-fill saved signaling URL
  signalingUrlEl.value = localStorage.getItem(SIGNALING_URL_KEY) || DEFAULT_SIGNALING_URL;

  const prefs = loadPlayerPreferences();
  const nickname = prefs.nickname || "Host";
  const mgr = new SessionManager();
  const unsubs = [];

  initLocalLanHostBlock();

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


    // Always prefer Azure, then user input, then local
    const signalingUrls = [
      AZURE_SIGNALING_URL,
      signalingUrl,
      LOCAL_SIGNALING_URL
    ].filter((url, idx, arr) => url && arr.indexOf(url) === idx);

    // Build and display the join code.
    // `u` keeps backward compatibility; `us` carries full candidate list.
    const joinCode = btoa(JSON.stringify({ s: mgr.sessionId, u: signalingUrls[0], us: signalingUrls }));
    joinCodeEl.value = joinCode;
    joinCodeCard.hidden = false;
    peersCard.hidden = false;
    actionsCard.hidden = false;

    // QR now carries only session payload for in-app scanner flow.
    const qrPayload = `GAMEJOIN:${joinCode}`;
    generateQRCode(qrCodeContainer, qrPayload);
    qrCodeCard.hidden = false;

    statusEl.textContent = `Session active — generated ${signalingUrls.length} signaling option(s) in Join Code.`;

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

  function initLocalLanHostBlock() {
    if (!localLanHostDisplayEl) {
      return;
    }

    refreshDetectedLanHost();

    signalingUrlEl?.addEventListener("change", () => {
      refreshDetectedLanHost();
    });

    copyLocalLanHostBtn?.addEventListener("click", () => {
      const value = localLanHostDisplayEl.value.trim();
      if (!value) {
        return;
      }
      navigator.clipboard.writeText(value).then(() => {
        copyLocalLanHostBtn.textContent = "Copied!";
        setTimeout(() => { copyLocalLanHostBtn.textContent = "Copy"; }, 1200);
      });
    });

    useLocalLanHostBtn?.addEventListener("click", () => {
      const value = localLanHostDisplayEl.value.trim();
      if (!value || !extraHostInputEl) {
        return;
      }
      extraHostInputEl.value = value;
      statusEl.textContent = `Extra Host filled with detected LAN host: ${value}`;
      statusEl.style.color = "";
    });
  }

  async function refreshDetectedLanHost() {
    const fromSignaling = extractPrivateHostFromUrl(signalingUrlEl?.value);
    if (fromSignaling) {
      setDetectedLanHost(fromSignaling, "Detected from signaling URL.");
      return;
    }

    setDetectedLanHost("", "Trying to detect LAN host from signaling server…");

    const fromServer = await detectLanHostFromSignalingServer(signalingUrlEl?.value);
    if (fromServer) {
      setDetectedLanHost(fromServer, "Detected from signaling server network interfaces.");
      return;
    }

    const fromWebRtc = await detectLanIpViaWebRtc();
    if (fromWebRtc) {
      setDetectedLanHost(fromWebRtc, "Detected from device network.");
      return;
    }

    setDetectedLanHost("", "Could not auto-detect. Enter IP/domain manually in Extra Host.");
  }

  function setDetectedLanHost(host, hintText) {
    if (!localLanHostDisplayEl) {
      return;
    }

    localLanHostDisplayEl.value = host || "";
    localLanHostDisplayEl.placeholder = host ? "" : "Not detected";
    if (localLanHostHintEl) {
      localLanHostHintEl.textContent = hintText;
    }
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

function buildSignalingUrlCandidates({ baseSignalingUrl, extraHost }) {
  const urls = [];
  const parsedBase = parseSignalingUrl(baseSignalingUrl);
  if (!parsedBase) {
    return [baseSignalingUrl];
  }

  const addCandidate = (hostValue) => {
    const normalizedHost = String(hostValue || "").trim();
    if (!normalizedHost) {
      return;
    }

    const candidate = new URL(parsedBase.url.toString());
    candidate.hostname = normalizedHost;
    urls.push(candidate.toString());
  };

  // Prefer explicit host (LAN/public) first when provided, then configured URL, then localhost fallback.
  addCandidate(extraHost);
  urls.push(parsedBase.url.toString());
  addCandidate("localhost");

  return dedupe(urls);
}

function parseSignalingUrl(signalingUrl) {
  try {
    return { url: new URL(String(signalingUrl || "")) };
  } catch {
    return null;
  }
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

function extractPrivateHostFromUrl(urlText) {
  try {
    const parsed = new URL(String(urlText || "").trim());
    const host = parsed.hostname;
    return isPrivateIpv4(host) ? host : "";
  } catch {
    return "";
  }
}

function isPrivateIpv4(host) {
  const ip = String(host || "").trim();
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
    return false;
  }

  const parts = ip.split(".").map((part) => Number.parseInt(part, 10));
  if (parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return false;
  }

  return parts[0] === 10
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    || (parts[0] === 192 && parts[1] === 168);
}

async function detectLanIpViaWebRtc() {
  const RTCPeer = window.RTCPeerConnection || window.webkitRTCPeerConnection;
  if (!RTCPeer) {
    return "";
  }

  let peer = null;
  try {
    peer = new RTCPeer({ iceServers: [] });
    peer.createDataChannel("lan-detect");

    const detectionPromise = new Promise((resolve) => {
      const timeout = window.setTimeout(() => resolve(""), 1800);

      peer.onicecandidate = (event) => {
        const candidate = event?.candidate?.candidate || "";
        const match = candidate.match(/(\d+\.\d+\.\d+\.\d+)/);
        if (!match) {
          return;
        }

        const ip = match[1];
        if (isPrivateIpv4(ip)) {
          window.clearTimeout(timeout);
          resolve(ip);
        }
      };
    });

    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    return await detectionPromise;
  } catch {
    return "";
  } finally {
    peer?.close();
  }
}

async function detectLanHostFromSignalingServer(signalingUrl) {
  const endpoint = buildNetworkInfoEndpoint(signalingUrl);
  if (!endpoint) {
    return "";
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 2500);

  try {
    const response = await fetch(endpoint, {
      method: "GET",
      mode: "cors",
      cache: "no-store",
      signal: controller.signal
    });

    if (!response.ok) {
      return "";
    }

    const payload = await response.json();
    if (!Array.isArray(payload?.hosts)) {
      return "";
    }

    return payload.hosts.find((host) => isPrivateIpv4(host)) || "";
  } catch {
    return "";
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function buildNetworkInfoEndpoint(signalingUrl) {
  try {
    const parsed = new URL(String(signalingUrl || "").trim());
    const httpProtocol = parsed.protocol === "wss:" ? "https:" : "http:";
    return `${httpProtocol}//${parsed.host}/api/network/local-addresses`;
  } catch {
    return "";
  }
}

