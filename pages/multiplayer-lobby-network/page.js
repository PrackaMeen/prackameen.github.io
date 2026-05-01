import { HEARTBEAT_INTERVAL_MS, POLL_INTERVAL_MS } from "../../session/ApiConfig.js";
import { createDefaultRoomApiClient, parseRoomJoinCode } from "../../session/RoomApiClient.js";
import { loadPlayerPreferences } from "../../player-preferences.js";

export function mountPage(context) {
  context.setTitle("Multiplayer / Network Join");

  const statusEl = document.getElementById("joinStatus");
  const activeRoomsCard = document.getElementById("activeRoomsCard");
   const joinFormCard = document.getElementById("joinFormCard");
  const waitingRoomCountEl = document.getElementById("waitingRoomCount");
  const waitingRoomsStatusEl = document.getElementById("waitingRoomsStatus");
  const waitingRoomListEl = document.getElementById("waitingRoomList");
  const joinBtn = document.getElementById("joinBtn");
  const scanQrBtn = document.getElementById("scanQrBtn");
  const stopScanBtn = document.getElementById("stopScanBtn");
  const scannerCard = document.getElementById("scannerCard");
  const scannerVideo = document.getElementById("scannerVideo");
  const scannerStatus = document.getElementById("scannerStatus");
  const peersCard = document.getElementById("peersCard");
  const peerListEl = document.getElementById("peerList");
  const peerCountEl = document.getElementById("peerCount");
  const chatCardEl = document.getElementById("chatCard");
  const messageLogEl = document.getElementById("messageLog");
  const chatForm = document.getElementById("chatForm");
  const chatInput = document.getElementById("chatInput");
  const chatSendBtn = chatForm.querySelector(".chat-send-btn");
  const actionsCard = document.getElementById("actionsCard");
  const goSettingsBtn = document.getElementById("goToSettingsBtn");

  const prefs = loadPlayerPreferences();
  const nickname = prefs.nickname || "";
  const roomApi = createDefaultRoomApiClient();
  const localPlayerIdStorageKeyPrefix = "game-network-local-player-id";
  const unsubs = [];
  let scanStream = null;
  let scanFrameHandle = null;
  let scanDetector = null;
  let pollTimer = null;
  let heartbeatTimer = null;
  let activeRoomId = "";
  let activePlayerId = "";
  let waitingRoomsPollTimer = null;
  let pendingScanJoinTarget = null;
  let chatSubmitHandler = null;

  chatCardEl.hidden = true;

  // ── auto-join from QR code URL param ──────────────────────────────────────

  const urlParams = new URLSearchParams(window.location.search);
  const codeFromUrl = urlParams.get("code");
  if (codeFromUrl) {
    const parsedUrlJoin = parseRoomJoinCode(codeFromUrl);
    if (parsedUrlJoin.roomId) {
      pendingScanJoinTarget = parsedUrlJoin;
      void joinRoomById(parsedUrlJoin.roomId, parsedUrlJoin.apiBaseUrl || roomApi.apiBaseUrl);
    }
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

  if (waitingRoomListEl) {
    waitingRoomListEl.addEventListener("click", async (event) => {
      const button = event.target.closest("button[data-room-id]");
      if (!button) {
        return;
      }

      const roomId = button.dataset.roomId || "";
      const apiBaseUrl = button.dataset.apiBaseUrl || roomApi.apiBaseUrl;
      if (!roomId) {
        return;
      }

      try {
        await joinRoomById(roomId, apiBaseUrl);
      } catch {
        // The status label already reflects the error.
      }
    });
  }

  if (joinBtn) {
    joinBtn.addEventListener("click", async () => {
      if (!pendingScanJoinTarget?.roomId) {
        statusEl.textContent = "Scan a QR code first, or use the waiting rooms list.";
        statusEl.style.color = "#b91c1c";
        return;
      }

      try {
        await joinRoomById(pendingScanJoinTarget.roomId, pendingScanJoinTarget.apiBaseUrl || roomApi.apiBaseUrl);
      } catch {
        // Status is already set by the join helper.
      }
    });
  }

  // ── peer rendering ────────────────────────────────────────────────────────

  function renderPeers(peers, localPlayerId = "") {
    peerCountEl.textContent = `(${peers.length})`;
    goSettingsBtn.disabled = peers.length < 2;

    if (peers.length === 0) {
      peerListEl.innerHTML = '<li class="peer-item peer-item--empty">No peers yet.</li>';
      return;
    }
    peerListEl.innerHTML = peers.map((p) => {
      const cls = p.isHost ? "peer-badge peer-badge--host" : "peer-badge";
      const peerIdentifier = p.peerId || p.playerId || p.id || "";
      const isSelf = !!localPlayerId && peerIdentifier === localPlayerId;
      const displayName = isSelf ? "You" : p.nickname || p.playerName || (peerIdentifier ? peerIdentifier.slice(0, 8) : "Unknown");
      return `<li class="peer-item">
        <span>${escHtml(displayName)}</span>
        <span class="${cls}">${p.isHost ? "Host" : "Peer"}</span>
      </li>`;
    }).join("");
  }

  function renderMessages(messages, localPlayerId = "") {
    const entries = Array.isArray(messages) ? messages : [];
    if (entries.length === 0) {
      messageLogEl.innerHTML = '<li class="message-item message-item--empty">No messages yet.</li>';
      return;
    }

    messageLogEl.innerHTML = entries.map((message) => {
      const isSelf = !!localPlayerId && message.playerId === localPlayerId;
      const time = formatTime(message.createdUtc);
      return `
        <li class="message-item ${isSelf ? "message-item--self" : ""}">
          <div class="message-item__copy">
            <span class="message-sender">${escHtml(message.playerName || message.playerId.slice(0, 8))}</span>
            <span class="message-text">${escHtml(message.text || "")}</span>
          </div>
          <span class="message-ts">${escHtml(time)}</span>
        </li>
      `;
    }).join("");

    messageLogEl.scrollTop = messageLogEl.scrollHeight;
  }

  function formatTime(value) {
    const parsed = Date.parse(value || "");
    if (Number.isNaN(parsed)) {
      return "Just now";
    }

    return new Date(parsed).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function setChatEnabled(isEnabled) {
    chatInput.disabled = false;
    chatSendBtn.disabled = false;
  }

  function showChat() {
    chatCardEl.hidden = false;
    setChatEnabled(true);
    window.setTimeout(() => chatInput.focus(), 0);
  }

  function hideChat() {
    chatCardEl.hidden = true;
    setChatEnabled(false);
  }

  function ensureChatHandler() {
    if (chatSubmitHandler) {
      return;
    }

    chatSubmitHandler = async (event) => {
      event.preventDefault();
      const text = chatInput.value.trim();
      if (!text || !activeRoomId || !activePlayerId) {
        return;
      }

      chatInput.value = "";

      try {
        const snapshot = await roomApi.sendRoomMessage(activeRoomId, activePlayerId, nickname, text);
        renderRoomSnapshot(snapshot);
      } catch (err) {
        statusEl.textContent = `Unable to send message: ${err.message}`;
        statusEl.style.color = "#b91c1c";
      }
    };

    chatForm.addEventListener("submit", chatSubmitHandler);
  }

  // ── join ──────────────────────────────────────────────────────────────────

  // ── proceed ───────────────────────────────────────────────────────────────

  goSettingsBtn.addEventListener("click", () => {
    context.setRoute("multiplayer-lobby-joined-game-settings");
  });

  function renderRoomSnapshot(snapshot) {
    renderPeers(snapshot?.players || [], activePlayerId);
     renderMessages(snapshot?.messages || [], activePlayerId);
    if (!snapshot) {
      return;
    }

    statusEl.textContent = `Room ${snapshot.roomId} is ${snapshot.status || "waiting to start"} · state v${snapshot.stateVersion || 0}`;
    statusEl.style.color = "";
  }

   function resetJoinView(message) {
     activeRoomId = "";
     activePlayerId = "";
     pendingScanJoinTarget = null;
     stopTimers();
     stopWaitingRoomsPolling();
     joinFormCard.hidden = false;
     activeRoomsCard.hidden = false;
     peersCard.hidden = true;
     actionsCard.hidden = true;
    hideChat();
     joinBtn.disabled = false;
     setJoinUiBusy(false);
     statusEl.textContent = message || "Scan the host QR code or join from the waiting rooms list below.";
     statusEl.style.color = "";
     startWaitingRoomsPolling();
   }

   function isRoomMissingError(err) {
     const message = String(err?.message || "").toLowerCase();
     return message.includes("room not found") || message.includes("player not found") || message.includes("room or player not found");
   }

  function formatUpdatedLabel(updatedUtc) {
    const parsed = Date.parse(updatedUtc || "");
    if (Number.isNaN(parsed)) {
      return "Updated recently";
    }

    return `Updated ${new Date(parsed).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  }

  function pickLatestPlayerId(players) {
    for (let index = players.length - 1; index >= 0; index -= 1) {
      if (!players[index]?.isHost) {
        return players[index].playerId || "";
      }
    }

    return "";
  }

  function resolveLocalPlayerId(snapshot, roomId, apiBaseUrl) {
    const storedPlayerId = loadStoredLocalPlayerId(roomId, apiBaseUrl);
    if (storedPlayerId && Array.isArray(snapshot?.players) && snapshot.players.some((player) => player.playerId === storedPlayerId)) {
      return storedPlayerId;
    }

    const exactNicknameMatches = (snapshot?.players || []).filter((player) => !player.isHost && player.playerName === nickname);
    if (exactNicknameMatches.length === 1) {
      return exactNicknameMatches[0].playerId || "";
    }

    return pickLatestPlayerId(snapshot?.players || []);
  }

  function loadStoredLocalPlayerId(roomId, apiBaseUrl) {
    try {
      return localStorage.getItem(getLocalPlayerStorageKey(roomId, apiBaseUrl)) || "";
    } catch {
      return "";
    }
  }

  function storeLocalPlayerId(roomId, apiBaseUrl, playerId) {
    if (!roomId || !apiBaseUrl || !playerId) {
      return;
    }

    try {
      localStorage.setItem(getLocalPlayerStorageKey(roomId, apiBaseUrl), playerId);
    } catch {
      // Persistence is best-effort only.
    }
  }

  function getLocalPlayerStorageKey(roomId, apiBaseUrl) {
    return `${localPlayerIdStorageKeyPrefix}:${apiBaseUrl}:${roomId}`;
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function isJoinPageActive() {
    return document.body?.dataset?.page === "multiplayer-lobby-network";
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
         if (isRoomMissingError(err)) {
           resetJoinView("You were removed from the room.");
           return;
         }

        statusEl.textContent = `Room refresh failed: ${err.message}`;
        statusEl.style.color = "#b91c1c";
      }
    };

    refreshRoom();
    pollTimer = window.setInterval(refreshRoom, POLL_INTERVAL_MS);
  }

  function stopPollingRoom() {
    if (typeof pollTimer !== "undefined" && pollTimer) {
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
         if (isRoomMissingError(err)) {
           resetJoinView("You were removed from the room.");
           return;
         }

        statusEl.textContent = `Room heartbeat failed: ${err.message}`;
        statusEl.style.color = "#b91c1c";
      }
    };

    sendHeartbeat();
    heartbeatTimer = window.setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
  }

  function stopHeartbeat() {
    if (typeof heartbeatTimer !== "undefined" && heartbeatTimer) {
      window.clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }

  function stopTimers() {
    stopPollingRoom();
    stopHeartbeat();
  }

  // ── dispose ───────────────────────────────────────────────────────────────

  startWaitingRoomsPolling();

  return {
    async dispose() {
       if (activeRoomId && activePlayerId) {
         void roomApi.removePlayer(activeRoomId, activePlayerId).catch(() => {
           // Best-effort leave only; navigation is already in progress.
         });
       }
       if (chatSubmitHandler) {
         chatForm.removeEventListener("submit", chatSubmitHandler);
         chatSubmitHandler = null;
       }
      stopTimers();
      stopWaitingRoomsPolling();
      stopScanner();
      unsubs.forEach(u => u?.());
    }
  };

  async function joinRoomById(roomId, apiBaseUrl) {
    try {
      roomApi.setApiBaseUrl(apiBaseUrl);
    } catch (err) {
      statusEl.textContent = `Error: ${err.message}`;
      statusEl.style.color = "#b91c1c";
      throw err;
    }

    setJoinUiBusy(true);
    statusEl.textContent = "Joining room…";
    statusEl.style.color = "";

    try {
      const snapshot = await roomApi.joinRoom(roomId, nickname);
      activePlayerId = resolveLocalPlayerId(snapshot, roomId, apiBaseUrl);
      storeLocalPlayerId(roomId, apiBaseUrl, activePlayerId);
      handleJoinedRoom(snapshot);
      return snapshot;
    } catch (err) {
      statusEl.textContent = `Error: ${err.message}`;
      statusEl.style.color = "#b91c1c";
      setJoinUiBusy(false);
      throw err;
    }
  }

  function handleJoinedRoom(snapshot) {
    activeRoomId = snapshot.roomId;
    peersCard.hidden = false;
    showChat();
    ensureChatHandler();
    actionsCard.hidden = true;
    joinFormCard.hidden = true;
    activeRoomsCard.hidden = true;
    stopWaitingRoomsPolling();
    renderRoomSnapshot(snapshot);
    statusEl.textContent = `Joined room ${snapshot.roomId}.`;
    startPollingRoom();
    startHeartbeat();
  }

  function setJoinUiBusy(isBusy) {
    joinBtn.disabled = isBusy;
    if (waitingRoomListEl) {
      waitingRoomListEl.querySelectorAll("button[data-room-id]").forEach((button) => {
        button.disabled = isBusy;
      });
    }
  }

  function renderWaitingRooms(rooms) {
    if (!waitingRoomCountEl || !waitingRoomsStatusEl || !waitingRoomListEl) {
      return;
    }

    waitingRoomCountEl.textContent = `(${rooms.length})`;

    if (rooms.length === 0) {
      waitingRoomsStatusEl.textContent = "No rooms are waiting to start right now.";
      waitingRoomListEl.innerHTML = '<li class="active-room-item active-room-item--empty">No waiting rooms available.</li>';
      return;
    }

    waitingRoomsStatusEl.textContent = "Select a room to join immediately, or scan a QR code.";
    waitingRoomListEl.innerHTML = rooms.map((room) => {
      const hostName = room.hostName || "Host";
      const playerCount = Array.isArray(room.players) ? room.players.length : 0;
      const updated = formatUpdatedLabel(room.updatedUtc);
      return `
        <li class="active-room-item">
          <div class="active-room-copy">
            <strong>${escHtml(hostName)}</strong>
            <span>Room ${escHtml(room.roomId)} · ${playerCount} player${playerCount === 1 ? "" : "s"}</span>
            <span>${escHtml(updated)}</span>
          </div>
          <button class="primary-btn active-room-join-btn" type="button" data-room-id="${escHtml(room.roomId)}" data-api-base-url="${escHtml(roomApi.apiBaseUrl)}">Join</button>
        </li>
      `;
    }).join("");
  }

  async function refreshWaitingRooms() {
    if (!isJoinPageActive()) {
      stopWaitingRoomsPolling();
      return;
    }

    try {
      const rooms = await roomApi.listWaitingToStartRooms();
      renderWaitingRooms(Array.isArray(rooms) ? rooms : []);
    } catch (err) {
      if (waitingRoomsStatusEl) {
        waitingRoomsStatusEl.textContent = `Unable to load waiting rooms: ${err.message}`;
      }
      if (waitingRoomListEl) {
        waitingRoomListEl.innerHTML = '<li class="active-room-item active-room-item--empty">Waiting rooms are unavailable right now.</li>';
      }
      if (waitingRoomCountEl) {
        waitingRoomCountEl.textContent = "(0)";
      }
    }
  }

  function startWaitingRoomsPolling() {
    if (!isJoinPageActive()) {
      return;
    }

    stopWaitingRoomsPolling();
    refreshWaitingRooms();
    waitingRoomsPollTimer = window.setInterval(refreshWaitingRooms, POLL_INTERVAL_MS);
  }

  function stopWaitingRoomsPolling() {
    if (waitingRoomsPollTimer) {
      window.clearInterval(waitingRoomsPollTimer);
      waitingRoomsPollTimer = null;
    }
  }

  async function startScanner() {
    if (!supportsQrScanning()) {
      statusEl.textContent = "In-app QR scanning is not supported on this device/browser. Use the waiting rooms list instead.";
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
        const parsedJoin = parseRoomJoinCode(rawValue);

        if (parsedJoin?.roomId) {
          pendingScanJoinTarget = parsedJoin;
          scannerStatus.textContent = "QR scanned. Joining room...";
          scannerStatus.style.color = "#15803d";
          stopScanner();

          try {
            await joinRoomById(parsedJoin.roomId, parsedJoin.apiBaseUrl || roomApi.apiBaseUrl);
          } catch {
            // The join helper already sets the visible error state.
          }
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

