/**
 * WebRtcTransport
 *
 * ITransport implementation using WebRTC RTCDataChannel for direct peer-to-peer
 * messaging. Signaling (SDP offer/answer exchange) is handled via SignalingClient
 * which connects to the G.A.M.E WebClient signaling relay server.
 *
 * Topology: star — host creates one RTCPeerConnection per client.
 *
 * Requirements:
 *   config.signalingUrl  WebSocket URL of the signaling server
 *                        e.g. "ws://192.168.1.1:5000/multiplayer/signaling"
 *
 * For LAN play:   run the G.A.M.E WebClient on any device on the network;
 *                 use that device's LAN IP in the URL.
 * For internet:   expose the WebClient publicly (port forward, ngrok, etc.)
 *                 and use the public URL.
 */

import { SignalingClient } from "../SignalingClient.js";

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
];

const ICE_GATHER_TIMEOUT_MS = 12_000;
const CLIENT_CONNECT_TIMEOUT_MS = 45_000;

function uuid() {
  return crypto.randomUUID();
}

function log(...args) {
  console.debug("[WebRtcTransport]", ...args);
}

export class WebRtcTransport {
  constructor() {
    this.peerId = uuid();
    this.isHost = false;

    this._sessionId = null;
    this._nickname = "";
    this._signalingUrl = null;

    /** @type {SignalingClient|null} */
    this._signalingClient = null;

    // Host: clientPeerId → { pc: RTCPeerConnection, dc: RTCDataChannel, nickname: string }
    this._peers = new Map();

    // Client: single connection to host
    this._hostPeerId = null;
    this._hostPc = null;
    this._hostDc = null;
    this._dcOpenResolve = null;

    this._onMessage = null;
    this._onPeerJoined = null;
    this._onPeerLeft = null;
  }

  // ── ITransport API ────────────────────────────────────────────────────────

  onMessage(handler) { this._onMessage = handler; }
  onPeerJoined(handler) { this._onPeerJoined = handler; }
  onPeerLeft(handler) { this._onPeerLeft = handler; }

  /**
   * @param {{ sessionId, peerId?, isHost, nickname, signalingUrl }} config
   */
  async connect(config) {
    this.isHost = config.isHost;
    this._sessionId = config.sessionId;
    this._nickname = config.nickname || "Player";
    this._signalingUrl = config.signalingUrl;

    if (config.peerId) this.peerId = config.peerId;

    if (!this._signalingUrl) {
      throw new Error("signalingUrl is required for WebRtcTransport");
    }

    log(`${this.isHost ? "host" : "client"} connecting, session=${this._sessionId}`);

    this._signalingClient = new SignalingClient(this._signalingUrl, this.peerId);
    await this._signalingClient.connect();

    if (this.isHost) {
      await this._initAsHost();
    } else {
      await this._initAsClient();
    }
  }

  async send(envelope) {
    const data = JSON.stringify(envelope);

    if (this.isHost) {
      // Fan-out to all connected clients
      for (const [peerId, peer] of this._peers) {
        if (peer.dc.readyState === "open") {
          try { peer.dc.send(data); } catch (e) { log(`send error to ${peerId}:`, e); }
        }
      }
    } else {
      // Send to host only
      if (this._hostDc?.readyState === "open") {
        this._hostDc.send(data);
      }
    }
  }

  async sendTo(targetPeerId, envelope) {
    const data = JSON.stringify(envelope);

    if (this.isHost) {
      const peer = this._peers.get(targetPeerId);
      if (peer?.dc.readyState === "open") {
        peer.dc.send(data);
      }
    }
  }

  async disconnect() {
    this._signalingClient?.disconnect();
    this._signalingClient = null;

    for (const [, peer] of this._peers) {
      try { peer.dc.close(); } catch {}
      try { peer.pc.close(); } catch {}
    }
    this._peers.clear();

    if (this._hostDc) {
      try { this._hostDc.close(); } catch {}
      this._hostDc = null;
    }
    if (this._hostPc) {
      try { this._hostPc.close(); } catch {}
      this._hostPc = null;
    }
  }

  // ── Host internals ────────────────────────────────────────────────────────

  async _initAsHost() {
    await this._signalingClient.hostSession(this._sessionId, this._nickname);
    log("host: registered with signaling server");

    // A new peer announced itself to the server — create a WebRTC connection for them
    this._signalingClient.onPeerJoined(async (clientPeerId, clientNickname) => {
      log(`host: peer-joined from signaling: ${clientPeerId} (${clientNickname})`);
      try {
        await this._hostCreatePeerConnection(clientPeerId, clientNickname);
      } catch (e) {
        log(`host: failed to set up connection for ${clientPeerId}:`, e);
      }
    });

    // Client sent us an answer — complete the handshake
    this._signalingClient.onSignal(async (fromPeerId, data) => {
      if (data.type === "answer") {
        log(`host: received answer from ${fromPeerId}`);
        await this._hostApplyAnswer(fromPeerId, data.sdp);
      }
    });

    this._signalingClient.onPeerLeft((leftPeerId) => {
      this._hostRemovePeer(leftPeerId);
    });

    this._signalingClient.onError((message) => {
      log("host: signaling error:", message);
    });

    // Host resolves immediately — it's ready to accept peers
  }

  async _hostCreatePeerConnection(clientPeerId, clientNickname) {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const dc = pc.createDataChannel("game", { ordered: true });

    this._peers.set(clientPeerId, { pc, dc, nickname: clientNickname });

    dc.onopen = () => {
      log(`host: data channel open with ${clientPeerId}`);
      this._onPeerJoined?.({ peerId: clientPeerId, nickname: clientNickname });
    };

    dc.onclose = () => {
      log(`host: data channel closed with ${clientPeerId}`);
      this._hostRemovePeer(clientPeerId);
    };

    dc.onmessage = (event) => {
      try {
        const envelope = JSON.parse(event.data);
        this._onMessage?.(envelope, clientPeerId);
      } catch (e) {
        log("host: failed to parse message:", e);
      }
    };

    pc.oniceconnectionstatechange = () => {
      log(`host: ICE state for ${clientPeerId}: ${pc.iceConnectionState}`);
      if (pc.iceConnectionState === "failed") {
        log(`host: connection failed for ${clientPeerId} — check STUN/TURN reachability`);
        this._hostRemovePeer(clientPeerId);
      }
    };

    // Create offer, gather ICE, send to client
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await this._waitForIceGathering(pc);

    // Bundle all ICE candidates into the SDP (they are embedded by the browser)
    this._signalingClient.sendSignal(clientPeerId, {
      type: "offer",
      sdp: pc.localDescription.sdp,
    });

    log(`host: sent offer to ${clientPeerId}`);
  }

  async _hostApplyAnswer(clientPeerId, sdp) {
    const peer = this._peers.get(clientPeerId);
    if (!peer) {
      log(`host: got answer for unknown peer ${clientPeerId}`);
      return;
    }
    try {
      await peer.pc.setRemoteDescription({ type: "answer", sdp });
      log(`host: applied answer from ${clientPeerId}`);
    } catch (e) {
      log(`host: failed to apply answer from ${clientPeerId}:`, e);
    }
  }

  _hostRemovePeer(peerId) {
    const peer = this._peers.get(peerId);
    if (!peer) return;

    try { peer.dc.close(); } catch {}
    try { peer.pc.close(); } catch {}
    this._peers.delete(peerId);
    this._onPeerLeft?.(peerId);
  }

  // ── Client internals ──────────────────────────────────────────────────────

  _initAsClient() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(
          `Connection timed out after ${CLIENT_CONNECT_TIMEOUT_MS / 1000}s. ` +
          `Verify the join code and that the host is online.`
        ));
      }, CLIENT_CONNECT_TIMEOUT_MS);

      this._signalingClient.onError((message) => {
        clearTimeout(timeout);
        reject(new Error(`Signaling error: ${message}`));
      });

      this._signalingClient.onPeerLeft((leftPeerId) => {
        if (leftPeerId === this._hostPeerId) {
          this._onPeerLeft?.(leftPeerId);
        }
      });

      this._signalingClient.onSignal(async (fromPeerId, data) => {
        if (data.type !== "offer") return;

        log(`client: received offer from ${fromPeerId}`);
        this._hostPeerId = fromPeerId;

        // Set resolve callback before processing offer so dc.onopen can fire it
        this._dcOpenResolve = () => {
          clearTimeout(timeout);
          this._dcOpenResolve = null;
          resolve();
        };

        try {
          await this._clientProcessOffer(fromPeerId, data.sdp);
        } catch (e) {
          clearTimeout(timeout);
          this._dcOpenResolve = null;
          reject(e);
        }
      });

      // Tell the signaling server we want to join — host will send an offer
      this._signalingClient.joinSession(this._sessionId, this._nickname);
      log("client: sent join request to signaling server");
    });
  }

  async _clientProcessOffer(hostPeerId, sdp) {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this._hostPc = pc;

    // The host creates the DataChannel; we receive it here
    pc.ondatachannel = (event) => {
      const dc = event.channel;
      this._hostDc = dc;
      log("client: received data channel from host");

      dc.onopen = () => {
        log("client: data channel open");
        this._onPeerJoined?.({ peerId: hostPeerId, nickname: "Host", isHost: true });
        this._dcOpenResolve?.();
      };

      dc.onclose = () => {
        log("client: data channel closed");
        this._onPeerLeft?.(hostPeerId);
      };

      dc.onmessage = (event) => {
        try {
          const envelope = JSON.parse(event.data);
          this._onMessage?.(envelope, hostPeerId);
        } catch (e) {
          log("client: failed to parse message:", e);
        }
      };
    };

    pc.oniceconnectionstatechange = () => {
      log(`client: ICE state: ${pc.iceConnectionState}`);
    };

    await pc.setRemoteDescription({ type: "offer", sdp });
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    await this._waitForIceGathering(pc);

    // Send bundled answer to host via signaling
    this._signalingClient.sendSignal(hostPeerId, {
      type: "answer",
      sdp: pc.localDescription.sdp,
    });

    log("client: sent answer to host");
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  _waitForIceGathering(pc) {
    if (pc.iceGatheringState === "complete") return Promise.resolve();

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        log("ICE gathering timed out — using partial candidates");
        pc.removeEventListener("icegatheringstatechange", onStateChange);
        resolve();
      }, ICE_GATHER_TIMEOUT_MS);

      function onStateChange() {
        if (pc.iceGatheringState === "complete") {
          clearTimeout(timeout);
          pc.removeEventListener("icegatheringstatechange", onStateChange);
          resolve();
        }
      }

      pc.addEventListener("icegatheringstatechange", onStateChange);
    });
  }
}
