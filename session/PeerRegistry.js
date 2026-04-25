/**
 * PeerRegistry — tracks connected peers for the current session.
 *
 * Populated by:
 *   • Transport onPeerJoined / onPeerLeft callbacks
 *   • system messages in the MessageBus stream
 *
 * Each peer entry:
 * {
 *   peerId:    string,
 *   nickname:  string,
 *   character: string,
 *   color:     string,
 *   isHost:    boolean,
 *   joinedAt:  number  (ms timestamp)
 * }
 */

export class PeerRegistry {
  constructor() {
    this._peers = new Map(); // peerId → peerInfo
    this._subscribers = [];
  }

  // ── registration ──────────────────────────────────────────────────────────

  /**
   * Add or update a peer entry.
   * @param {object} peerInfo — must contain peerId
   */
  upsert(peerInfo) {
    const existing = this._peers.get(peerInfo.peerId) || {};
    const merged = { character: "", color: "", isHost: false, joinedAt: Date.now(), ...existing, ...peerInfo };
    this._peers.set(peerInfo.peerId, merged);
    this._notify();
  }

  /**
   * Remove a peer.
   * @param {string} peerId
   */
  remove(peerId) {
    if (this._peers.delete(peerId)) {
      this._notify();
    }
  }

  // ── query ─────────────────────────────────────────────────────────────────

  /** @returns {object[]} ordered by joinedAt ascending */
  getAll() {
    return Array.from(this._peers.values()).sort((a, b) => a.joinedAt - b.joinedAt);
  }

  /** @param {string} peerId @returns {object|undefined} */
  get(peerId) {
    return this._peers.get(peerId);
  }

  /** @returns {number} */
  get count() {
    return this._peers.size;
  }

  // ── subscription ──────────────────────────────────────────────────────────

  /**
   * Subscribe to peer list changes.
   * @param {function(peers: object[]): void} handler
   * @returns {function} unsubscribe
   */
  onChange(handler) {
    this._subscribers.push(handler);
    return () => {
      this._subscribers = this._subscribers.filter(h => h !== handler);
    };
  }

  _notify() {
    const peers = this.getAll();
    for (const handler of this._subscribers) {
      try { handler(peers); } catch { /* isolated */ }
    }
  }
}
