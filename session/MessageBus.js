/**
 * MessageBus
 *
 * Composes an ITransport with a MessageStore to deliver an ordered,
 * deduplicated, persistent stream of message envelopes.
 *
 * Responsibilities:
 *   • Host: assign global seq numbers, store, fan-out to all peers.
 *   • Client: forward outgoing messages to host; receive sequenced messages
 *             from host, buffer gaps, flush in order, persist after flush.
 *   • Both: fire onMessage subscribers once per message, strictly in seq order.
 *   • Sync: handle sync-request / sync-response for reconnecting peers.
 *
 * Message envelope shape:
 * {
 *   seq:       number,   // 0 = not yet sequenced (outbound from client)
 *   sessionId: string,
 *   senderId:  string,
 *   type:      "chat" | "action" | "system" | "sync-request" | "sync-response",
 *   ts:        number,   // sender wall-clock ms
 *   payload:   object
 * }
 */

import { MessageStore } from "./MessageStore.js";

const SYNC_TIMEOUT_MS = 8000;

export class MessageBus {
  constructor(transport) {
    this._transport = transport;
    this._store = new MessageStore();

    this._sessionId = null;
    this._nextSeq = 1;       // host-only: monotonically increasing
    this._lastFlushed = 0;   // highest seq delivered to subscribers
    this._gapBuffer = new Map(); // seq → envelope (received but not yet flushed)

    this._subscribers = [];

    this._transport.onMessage(this._handleIncoming.bind(this));
  }

  // ── public API ────────────────────────────────────────────────────────────

  /**
   * @param {string} sessionId
   * @param {number} [resumeFromSeq=0] — set when reconnecting
   */
  async init(sessionId, resumeFromSeq = 0) {
    this._sessionId = sessionId;
    this._lastFlushed = resumeFromSeq;

    if (this._transport.isHost) {
      // Restore next seq from store in case host page was reloaded
      const lastSeq = await this._store.getLastSeq(sessionId);
      this._nextSeq = lastSeq + 1;
    }
  }

  /**
   * Subscribe to ordered, deduplicated message delivery.
   * @param {function(envelope): void} handler
   * @returns {function} unsubscribe
   */
  onMessage(handler) {
    this._subscribers.push(handler);
    return () => {
      this._subscribers = this._subscribers.filter(h => h !== handler);
    };
  }

  /**
   * Send a message. Payload is merged into an envelope.
   * @param {{ type: string, payload: object }} partial
   */
  async send(type, payload) {
    const envelope = {
      seq: 0,
      sessionId: this._sessionId,
      senderId: this._transport.peerId,
      type,
      ts: Date.now(),
      payload
    };

    if (this._transport.isHost) {
      await this._hostSequenceAndBroadcast(envelope);
    } else {
      await this._transport.send(envelope);
      // Client waits for the sequenced echo from host before persisting
    }
  }

  /**
   * Request history from the host starting at fromSeq.
   * Called after reconnect to catch up on missed messages.
   * @param {number} fromSeq
   * @returns {Promise<void>} resolves when sync-response has been processed
   */
  requestSync(fromSeq) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Sync timeout")), SYNC_TIMEOUT_MS);

      const unsub = this.onMessage((envelope) => {
        if (envelope.type === "sync-response" && envelope.payload.fromSeq === fromSeq) {
          clearTimeout(timeout);
          unsub();
          resolve();
        }
      });

      this.send("sync-request", { fromSeq }).catch(reject);
    });
  }

  // ── internal ──────────────────────────────────────────────────────────────

  async _handleIncoming(envelope, fromPeerId) {
    console.debug("[MessageBus] _handleIncoming isHost=", this._transport.isHost, "type=", envelope.type, "seq=", envelope.seq, "from=", fromPeerId);
    if (this._transport.isHost) {
      await this._hostHandleFromClient(envelope, fromPeerId);
    } else {
      await this._clientHandleFromHost(envelope);
    }
  }

  // Host: receive a message from a client, assign seq, broadcast, store
  async _hostHandleFromClient(envelope, fromPeerId) {
    if (envelope.type === "sync-request") {
      await this._hostServeSyncRequest(fromPeerId, envelope.payload.fromSeq);
      return;
    }

    await this._hostSequenceAndBroadcast(envelope);
  }

  async _hostSequenceAndBroadcast(envelope) {
    const sequenced = { ...envelope, seq: this._nextSeq++ };
    console.debug("[MessageBus] host sequencing", sequenced.seq, "lastFlushed=", this._lastFlushed, "subscribers=", this._subscribers.length);

    // Persist first
    await this._store.append(sequenced);

    // Fan out to all peers (BroadcastChannel transport handles the routing)
    await this._transport.send(sequenced);

    // Deliver locally to host subscribers
    this._flushIfContiguous(sequenced);
    console.debug("[MessageBus] after flush lastFlushed=", this._lastFlushed);
  }

  async _hostServeSyncRequest(requestingPeerId, fromSeq) {
    const history = await this._store.getFrom(this._sessionId, fromSeq);
    const response = {
      seq: 0,
      sessionId: this._sessionId,
      senderId: this._transport.peerId,
      type: "sync-response",
      ts: Date.now(),
      payload: { fromSeq, messages: history }
    };
    await this._transport.sendTo(requestingPeerId, response);
  }

  // Client: receive a sequenced message from the host
  async _clientHandleFromHost(envelope) {
    console.debug("[MessageBus] client got from host: type=", envelope.type, "seq=", envelope.seq, "lastFlushed=", this._lastFlushed);
    if (envelope.type === "sync-response") {
      // Replay all messages in the sync response in order
      const { messages } = envelope.payload;
      if (Array.isArray(messages)) {
        for (const msg of messages) {
          await this._store.append(msg);
          this._flushIfContiguous(msg);
        }
      }
      // Deliver the sync-response envelope itself so requestSync() can resolve
      this._emit(envelope);
      return;
    }

    if (envelope.seq <= 0) return; // unsequenced; ignore

    // Buffer and flush contiguous run
    this._gapBuffer.set(envelope.seq, envelope);
    await this._flushGapBuffer();
  }

  async _flushGapBuffer() {
    let next = this._lastFlushed + 1;
    while (this._gapBuffer.has(next)) {
      const envelope = this._gapBuffer.get(next);
      this._gapBuffer.delete(next);
      await this._store.append(envelope);
      this._flushIfContiguous(envelope);
      next++;
    }
  }

  _flushIfContiguous(envelope) {
    console.debug("[MessageBus] _flushIfContiguous seq=", envelope.seq, "lastFlushed=", this._lastFlushed, "match=", envelope.seq === this._lastFlushed + 1);
    if (envelope.seq === this._lastFlushed + 1) {
      this._lastFlushed = envelope.seq;
      this._emit(envelope);
    }
  }

  _emit(envelope) {
    console.debug("[MessageBus] _emit seq=", envelope.seq, "type=", envelope.type, "to", this._subscribers.length, "subscribers");
    for (const handler of this._subscribers) {
      try { handler(envelope); } catch (e) { console.error("[MessageBus] subscriber error", e); }
    }
  }
}
