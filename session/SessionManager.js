/**
 * SessionManager — owns the full lifecycle of a multiplayer session.
 *
 * Usage (host):
 *   const mgr = new SessionManager();
 *   await mgr.create({ nickname, transportType: "broadcast" });
 *   mgr.onMessage(envelope => { ... });
 *   await mgr.send("chat", { text: "Hello!" });
 *
 * Usage (client):
 *   const mgr = new SessionManager();
 *   await mgr.join({ sessionId, nickname, transportType: "broadcast" });
 *   mgr.onMessage(envelope => { ... });
 *   await mgr.send("chat", { text: "Hi!" });
 *
 * Reconnect:
 *   The manager persists sessionId + peerId + lastSeq in localStorage.
 *   Call mgr.reconnect() to resume and catch up from lastSeq.
 *
 * Events: onSessionReady, onPeerJoined, onPeerLeft, onDisconnected
 */

import { createTransport } from "./ITransport.js";
import { MessageBus } from "./MessageBus.js";
import { PeerRegistry } from "./PeerRegistry.js";

const MAX_PEERS = 8;
const STORAGE_KEY_PREFIX = "game-session-";

export class SessionManager {
  constructor() {
    this._transport = null;
    this._bus = null;
    this.peers = new PeerRegistry();

    this.sessionId = null;
    this.peerId = null;

    // event handlers
    this._onSessionReady = null;
    this._onDisconnected = null;
    this._onReconnecting = null;
  }

  // ── event registration ────────────────────────────────────────────────────

  onSessionReady(handler) { this._onSessionReady = handler; }
  onDisconnected(handler) { this._onDisconnected = handler; }
  onReconnecting(handler) { this._onReconnecting = handler; }

  onPeerJoined(handler) {
    return this.peers.onChange(() => handler(this.peers.getAll()));
  }

  onPeerLeft(handler) {
    return this.peers.onChange(() => handler(this.peers.getAll()));
  }

  /**
   * Subscribe to ordered messages from the bus.
   * @param {function(envelope): void} handler
   * @returns {function} unsubscribe
   */
  onMessage(handler) {
    if (!this._bus) throw new Error("Session not initialised");
    return this._bus.onMessage(handler);
  }

  // ── lifecycle ─────────────────────────────────────────────────────────────

  /**
   * Create a new session as host.
   * @param {{ nickname: string, transportType?: string }} options
   * @returns {Promise<string>} sessionId
   */
  async create({ nickname, transportType = "broadcast" }) {
    const sessionId = crypto.randomUUID();
    await this._initTransport({ sessionId, nickname, isHost: true, transportType });

    // Register self in peer registry
    this.peers.upsert({ peerId: this._transport.peerId, nickname, isHost: true, joinedAt: Date.now() });

    await this._bus.init(sessionId);
    this._saveState();

    this._onSessionReady && this._onSessionReady({ sessionId, isHost: true });
    return sessionId;
  }

  /**
   * Join an existing session as client.
   * @param {{ sessionId: string, nickname: string, transportType?: string }} options
   */
  async join({ sessionId, nickname, transportType = "broadcast" }) {
    if (this.peers.count >= MAX_PEERS) {
      throw new Error(`Session full (max ${MAX_PEERS} players)`);
    }

    await this._initTransport({ sessionId, nickname, isHost: false, transportType });

    // Register self
    this.peers.upsert({ peerId: this._transport.peerId, nickname, isHost: false, joinedAt: Date.now() });

    const lastSeq = await this._getStoredLastSeq(sessionId);
    await this._bus.init(sessionId, lastSeq);

    if (lastSeq > 0) {
      // Reconnecting — request missed messages
      this._onReconnecting && this._onReconnecting();
      await this._bus.requestSync(lastSeq + 1);
    }

    this._saveState();
    this._onSessionReady && this._onSessionReady({ sessionId, isHost: false });
  }

  /**
   * Resume a previous session from localStorage state.
   * @param {{ transportType?: string }} [options]
   * @returns {Promise<boolean>} true if state was found and restored
   */
  async reconnect({ transportType = "broadcast" } = {}) {
    const state = this._loadState();
    if (!state) return false;

    const { sessionId, peerId, nickname, isHost } = state;
    await this._initTransport({ sessionId, nickname, isHost, transportType, peerId });

    this.peers.upsert({ peerId, nickname, isHost, joinedAt: Date.now() });

    const lastSeq = await this._getStoredLastSeq(sessionId);
    await this._bus.init(sessionId, lastSeq);

    if (!isHost && lastSeq >= 0) {
      this._onReconnecting && this._onReconnecting();
      try {
        await this._bus.requestSync(lastSeq + 1);
      } catch {
        // Sync timeout is non-fatal; continue with cached history
      }
    }

    this._onSessionReady && this._onSessionReady({ sessionId, isHost });
    return true;
  }

  /**
   * Send a message into the session.
   * @param {string} type
   * @param {object} payload
   */
  async send(type, payload) {
    if (!this._bus) throw new Error("Session not initialised");
    await this._bus.send(type, payload);
  }

  /**
   * Leave the session and clean up.
   */
  async leave() {
    if (this._transport) {
      await this._transport.disconnect();
    }
    this._transport = null;
    this._bus = null;
    this._onDisconnected && this._onDisconnected();
  }

  // ── internal ──────────────────────────────────────────────────────────────

  async _initTransport({ sessionId, nickname, isHost, transportType, peerId }) {
    this._transport = await createTransport(transportType);
    this.sessionId = sessionId;
    this.peerId = peerId || this._transport.peerId;

    // Wire transport peer events into PeerRegistry
    this._transport.onPeerJoined((peerInfo) => {
      this.peers.upsert({ ...peerInfo, joinedAt: Date.now() });
    });

    this._transport.onPeerLeft((leftPeerId) => {
      this.peers.remove(leftPeerId);
    });

    this._bus = new MessageBus(this._transport);

    // Handle system envelopes that carry peer metadata updates
    this._bus.onMessage((envelope) => {
      if (envelope.type === "system" && envelope.payload && envelope.payload.event === "peer-info") {
        this.peers.upsert(envelope.payload.peerInfo);
      }
    });

    await this._transport.connect({ sessionId, peerId: this.peerId, isHost, nickname });
  }

  _saveState() {
    const key = `${STORAGE_KEY_PREFIX}${this.sessionId}`;
    const state = {
      sessionId: this.sessionId,
      peerId: this._transport.peerId,
      nickname: this.peers.get(this._transport.peerId)?.nickname || "",
      isHost: this._transport.isHost
    };
    try { localStorage.setItem(key, JSON.stringify(state)); } catch { /* storage quota */ }
  }

  _loadState() {
    try {
      // Find the most recently touched session key
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(STORAGE_KEY_PREFIX)) {
          const raw = localStorage.getItem(k);
          if (raw) return JSON.parse(raw);
        }
      }
    } catch { /* corrupt storage */ }
    return null;
  }

  async _getStoredLastSeq(sessionId) {
    try {
      const { MessageStore } = await import("./MessageStore.js");
      const store = new MessageStore();
      return await store.getLastSeq(sessionId);
    } catch {
      return -1;
    }
  }

  /**
   * Clears persisted state for a specific session (e.g. after leave).
   * @param {string} sessionId
   */
  clearStoredState(sessionId) {
    try { localStorage.removeItem(`${STORAGE_KEY_PREFIX}${sessionId}`); } catch { /* ok */ }
  }
}
