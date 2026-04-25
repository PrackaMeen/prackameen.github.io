/**
 * SignalingClient — WebSocket client for WebRTC SDP/ICE signaling.
 *
 * Connects to the G.A.M.E signaling relay server (the .NET WebClient) and
 * handles message routing for the offer/answer exchange needed to establish
 * direct WebRTC peer connections.
 *
 * Protocol (JSON over WebSocket):
 *
 * Client → Server:
 *   { type: "host",   sessionId, peerId, nickname }   host registers session
 *   { type: "join",   sessionId, peerId, nickname }   client requests to join
 *   { type: "signal", to: peerId, data: {...} }        forward SDP/ICE to peer
 *   { type: "ping" }                                   keep-alive
 *
 * Server → Client:
 *   { type: "hosted" }                                 → host: session registered
 *   { type: "peer-joined", peerId, nickname }          → host: new peer wants to join
 *   { type: "signal", from: peerId, data: {...} }      → forwarded SDP/ICE from peer
 *   { type: "peer-left", peerId }                      → peer disconnected
 *   { type: "error", message }
 *   { type: "pong" }
 */

const CONNECT_TIMEOUT_MS = 10_000;
const HOST_REGISTER_TIMEOUT_MS = 5_000;

function log(...args) {
  console.debug("[SignalingClient]", ...args);
}

export class SignalingClient {
  /**
   * @param {string} serverUrl  WebSocket URL e.g. "ws://192.168.1.1:5000/multiplayer/signaling"
   * @param {string} peerId     This peer's UUID
   */
  constructor(serverUrl, peerId) {
    this._url = serverUrl;
    this._peerId = peerId;
    this._ws = null;

    this._onPeerJoined = null;   // (peerId: string, nickname: string) => void
    this._onPeerLeft = null;     // (peerId: string) => void
    this._onSignal = null;       // (fromPeerId: string, data: object) => void
    this._onError = null;        // (message: string) => void
  }

  // ── event registration ────────────────────────────────────────────────────

  onPeerJoined(handler) { this._onPeerJoined = handler; }
  onPeerLeft(handler) { this._onPeerLeft = handler; }
  onSignal(handler) { this._onSignal = handler; }
  onError(handler) { this._onError = handler; }

  // ── lifecycle ─────────────────────────────────────────────────────────────

  /**
   * Open the WebSocket connection to the signaling server.
   * @returns {Promise<void>}
   */
  connect() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(
          `Signaling server connection timed out (${CONNECT_TIMEOUT_MS / 1000}s). ` +
          `Is the G.A.M.E WebClient running at ${this._url}?`
        ));
      }, CONNECT_TIMEOUT_MS);

      try {
        this._ws = new WebSocket(this._url);
      } catch (e) {
        clearTimeout(timeout);
        reject(new Error(`Invalid signaling URL: ${this._url}`));
        return;
      }

      this._ws.onopen = () => {
        clearTimeout(timeout);
        log(`connected to ${this._url}`);
        resolve();
      };

      this._ws.onerror = () => {
        clearTimeout(timeout);
        reject(new Error(
          `Cannot reach signaling server at ${this._url}. ` +
          `Make sure the G.A.M.E WebClient is running and accessible.`
        ));
      };

      this._ws.onclose = () => {
        log("connection closed");
      };

      this._ws.onmessage = (event) => this._handleMessage(event.data);
    });
  }

  /**
   * Register this peer as the session host.
   * @param {string} sessionId
   * @param {string} nickname
   * @returns {Promise<void>} resolves when server confirms registration
   */
  hostSession(sessionId, nickname) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Host registration timed out"));
      }, HOST_REGISTER_TIMEOUT_MS);

      // Temporarily override message handler to intercept the hosted ack
      const prevHandler = this._ws.onmessage;
      this._ws.onmessage = (event) => {
        let msg;
        try { msg = JSON.parse(event.data); } catch { return; }

        if (msg.type === "hosted") {
          clearTimeout(timeout);
          this._ws.onmessage = (e) => this._handleMessage(e.data);
          log("host: session registered");
          resolve();
        } else if (msg.type === "error") {
          clearTimeout(timeout);
          this._ws.onmessage = (e) => this._handleMessage(e.data);
          reject(new Error(msg.message));
        } else {
          // Other messages during registration — process normally
          this._handleMessage(event.data);
        }
      };

      this._send({ type: "host", sessionId, peerId: this._peerId, nickname });
    });
  }

  /**
   * Announce this peer to the host as a joining client.
   * The host will respond via the signaling channel (offer arrives asynchronously).
   * @param {string} sessionId
   * @param {string} nickname
   */
  joinSession(sessionId, nickname) {
    this._send({ type: "join", sessionId, peerId: this._peerId, nickname });
    log(`client: sent join for session ${sessionId}`);
  }

  /**
   * Forward SDP or ICE data to a specific peer.
   * @param {string} toPeerId
   * @param {object} data  e.g. { type: "offer", sdp: "..." } or { type: "answer", sdp: "..." }
   */
  sendSignal(toPeerId, data) {
    this._send({ type: "signal", to: toPeerId, data });
  }

  disconnect() {
    if (this._ws && this._ws.readyState === WebSocket.OPEN) {
      this._ws.close(1000, "Session ended");
    }
    this._ws = null;
  }

  // ── internal ──────────────────────────────────────────────────────────────

  _send(payload) {
    if (this._ws && this._ws.readyState === WebSocket.OPEN) {
      this._ws.send(JSON.stringify(payload));
    }
  }

  _handleMessage(data) {
    let msg;
    try { msg = JSON.parse(data); } catch { return; }

    log("received", msg.type, msg);

    switch (msg.type) {
      case "peer-joined":
        this._onPeerJoined?.(msg.peerId, msg.nickname);
        break;
      case "peer-left":
        this._onPeerLeft?.(msg.peerId);
        break;
      case "signal":
        this._onSignal?.(msg.from, msg.data);
        break;
      case "error":
        this._onError?.(msg.message);
        break;
      case "pong":
        break;
    }
  }
}
