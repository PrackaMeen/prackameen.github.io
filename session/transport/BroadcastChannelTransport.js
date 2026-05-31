/**
 * BroadcastChannelTransport
 *
 * Uses the browser BroadcastChannel API to route messages between tabs on
 * the same origin. Intended for same-device development and automated testing.
 *
 * Topology: star — host is the single message sequencer and relay.
 *
 * Internal protocol (raw frames on the channel):
 *   { frame: "peer-hello",   sessionId, fromPeerId, nickname }
 *   { frame: "peer-ack",     sessionId, toPeerId, peerInfo: {peerId,nickname} }
 *   { frame: "peer-list",    sessionId, toPeerId, peers: [{peerId,nickname}] }
 *   { frame: "peer-left",    sessionId, fromPeerId }
 *   { frame: "envelope",     sessionId, toPeerId|"*", fromPeerId, envelope }
 *     toPeerId="*" means broadcast to all peers (host → clients)
 *     toPeerId=<hostId> means addressed to host only (client → host)
 *
 * Joining flow:
 *   1. Client broadcasts peer-hello.
 *   2. Host receives peer-hello → registers peer → replies peer-ack (direct) +
 *      broadcasts peer-list update.
 *   3. Client receives peer-ack → marks itself connected.
 *
 * NOTE: BroadcastChannel works between same-origin contexts on the same device
 * (tabs, installed PWA windows). It does NOT work cross-device or cross-origin.
 */

const JOIN_TIMEOUT_MS = 15_000;

function uuid() {
  return crypto.randomUUID();
}

function log(...args) {
  // eslint-disable-next-line no-console
  console.debug("[BroadcastChannelTransport]", ...args);
}

export class BroadcastChannelTransport {
  constructor() {
    this.peerId = uuid();
    this.isHost = false;

    this._sessionId = null;
    this._channel = null;
    this._nickname = "";

    // host state
    this._peers = new Map(); // peerId → {peerId, nickname}

    // client state
    this._hostPeerId = null;
    this._connected = false;

    // callbacks
    this._onMessage = null;
    this._onPeerJoined = null;
    this._onPeerLeft = null;

    this._handleRaw = this._handleRaw.bind(this);
  }

  // ── public API ────────────────────────────────────────────────────────────

  onMessage(handler) { this._onMessage = handler; }
  onPeerJoined(handler) { this._onPeerJoined = handler; }
  onPeerLeft(handler) { this._onPeerLeft = handler; }

  /**
   * @param {{ sessionId: string, peerId?: string, isHost: boolean, nickname: string }} config
   */
  async connect(config) {
    this.isHost = config.isHost;
    this._sessionId = config.sessionId;
    this._nickname = config.nickname || "Player";

    if (config.peerId) {
      this.peerId = config.peerId;
    }

    const channelName = `game-${this._sessionId}`;
    log(`${this.isHost ? "host" : "client"} opening channel "${channelName}" as peerId=${this.peerId}`);

    this._channel = new BroadcastChannel(channelName);
    this._channel.addEventListener("message", this._handleRaw);

    if (this.isHost) {
      // Host registers itself in its own peer map
      this._peers.set(this.peerId, { peerId: this.peerId, nickname: this._nickname });
      log("host ready, waiting for peers");
    } else {
      // Client announces itself and waits for ack
      await this._joinAsClient();
    }
  }

  async send(envelope) {
    if (this.isHost) {
      // Host broadcasts to all
      this._post({ frame: "envelope", sessionId: this._sessionId, toPeerId: "*", fromPeerId: this.peerId, envelope });
    } else {
      // Client sends to host
      this._post({ frame: "envelope", sessionId: this._sessionId, toPeerId: this._hostPeerId, fromPeerId: this.peerId, envelope });
    }
  }

  async sendTo(targetPeerId, envelope) {
    this._post({ frame: "envelope", sessionId: this._sessionId, toPeerId: targetPeerId, fromPeerId: this.peerId, envelope });
  }

  async disconnect() {
    if (this._channel) {
      this._post({ frame: "peer-left", sessionId: this._sessionId, fromPeerId: this.peerId });
      this._channel.removeEventListener("message", this._handleRaw);
      this._channel.close();
      this._channel = null;
      log("disconnected");
    }
  }

  // ── internal ──────────────────────────────────────────────────────────────

  _post(data) {
    if (this._channel) {
      this._channel.postMessage(data);
    }
  }

  _handleRaw(event) {
    const msg = event.data;
    if (!msg || msg.sessionId !== this._sessionId) return;

    log(`received frame="${msg.frame}" toPeerId=${msg.toPeerId || "-"} fromPeerId=${msg.fromPeerId || "-"}`);

    switch (msg.frame) {
      case "peer-hello":
        if (this.isHost) this._hostHandlePeerHello(msg);
        break;

      case "peer-ack":
        if (!this.isHost && msg.toPeerId === this.peerId) {
          this._hostPeerId = msg.hostPeerId;
          this._connected = true;
          log(`client connected, hostPeerId=${this._hostPeerId}`);
          if (Array.isArray(msg.existingPeers)) {
            msg.existingPeers.forEach((p) => {
              if (p.peerId !== this.peerId) {
                this._onPeerJoined && this._onPeerJoined(p);
              }
            });
          }
        }
        break;

      case "peer-list":
        // Broadcast to all clients when a new peer joins
        if (!this.isHost && msg.toPeerId === "*") {
          if (msg.newPeer && msg.newPeer.peerId !== this.peerId) {
            this._onPeerJoined && this._onPeerJoined(msg.newPeer);
          }
        }
        break;

      case "peer-left":
        if (this.isHost) {
          this._peers.delete(msg.fromPeerId);
        }
        this._onPeerLeft && this._onPeerLeft(msg.fromPeerId);
        break;

      case "envelope":
        this._routeEnvelope(msg);
        break;

      default:
        break;
    }
  }

  _hostHandlePeerHello(msg) {
    log(`host received peer-hello from peerId=${msg.fromPeerId}`);
    const peerInfo = { peerId: msg.fromPeerId, nickname: msg.nickname };
    this._peers.set(msg.fromPeerId, peerInfo);

    // Ack directly to the joining peer, include existing peer list
    const existingPeers = Array.from(this._peers.values()).filter(p => p.peerId !== msg.fromPeerId);
    log(`host sending peer-ack to peerId=${msg.fromPeerId}`);
    this._post({
      frame: "peer-ack",
      sessionId: this._sessionId,
      toPeerId: msg.fromPeerId,
      hostPeerId: this.peerId,
      peerInfo,
      existingPeers
    });

    // Notify all other clients of the new peer
    this._post({ frame: "peer-list", sessionId: this._sessionId, toPeerId: "*", newPeer: peerInfo });

    this._onPeerJoined && this._onPeerJoined(peerInfo);
  }

  _routeEnvelope(msg) {
    if (this.isHost) {
      // Message from a client addressed to host
      if (msg.toPeerId === this.peerId) {
        this._onMessage && this._onMessage(msg.envelope, msg.fromPeerId);
      }
    } else {
      // Message from host broadcast ("*") or direct to this client
      if (msg.toPeerId === "*" || msg.toPeerId === this.peerId) {
        if (msg.fromPeerId !== this.peerId) {
          this._onMessage && this._onMessage(msg.envelope, msg.fromPeerId);
        }
      }
    }
  }

  _joinAsClient() {
    return new Promise((resolve, reject) => {
      let timeoutId = null;

      const cleanup = () => {
        clearTimeout(timeoutId);
        this._channel.removeEventListener("message", onMessage);
      };

      const onMessage = (event) => {
        const msg = event.data;
        if (msg && msg.frame === "peer-ack" && msg.toPeerId === this.peerId) {
          log("client received peer-ack, join complete");
          cleanup();
          resolve();
        }
      };

      this._channel.addEventListener("message", onMessage);

      timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error(
          `Could not reach host after ${JOIN_TIMEOUT_MS / 1000}s. ` +
          "Ensure the host is on the same device and has this session open. " +
          "BroadcastChannel only works between tabs/windows on the same device and origin."
        ));
      }, JOIN_TIMEOUT_MS);

      log(`client sending peer-hello to channel game-${this._sessionId}`);
      this._post({
        frame: "peer-hello",
        sessionId: this._sessionId,
        fromPeerId: this.peerId,
        nickname: this._nickname
      });
    });
  }
}

