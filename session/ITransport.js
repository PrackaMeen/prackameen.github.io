/**
 * ITransport — contract every transport implementation must satisfy.
 *
 * A transport handles the raw delivery of message envelopes between peers.
 * It does NOT assign sequence numbers, persist messages, or manage peers —
 * those responsibilities belong to MessageBus and SessionManager.
 *
 * Required surface:
 *
 *   peerId      {string}   — stable UUID for this peer in this session (readonly)
 *   isHost      {boolean}  — true when this peer is the session host (readonly)
 *
 *   connect(config)        → Promise<void>
 *     config: { sessionId, peerId, isHost, ...transport-specific }
 *     Resolves once the transport is ready to send/receive.
 *
 *   send(envelope)         → Promise<void>
 *     Send a message envelope to all other peers (host fan-out) or to the
 *     host only (client upload). The transport decides routing internally.
 *
 *   sendTo(peerId, envelope) → Promise<void>
 *     Send a message envelope directly to a specific peer (host-only use).
 *
 *   disconnect()           → Promise<void>
 *     Cleanly close all connections.
 *
 *   onMessage(handler)     — register handler(envelope, fromPeerId)
 *   onPeerJoined(handler)  — register handler(peerInfo: {peerId, nickname})
 *   onPeerLeft(handler)    — register handler(peerId)
 *
 * Implementations: BroadcastChannelTransport, WebRtcTransport, WebSocketTransport
 */

/**
 * Factory: resolve a transport instance by name.
 * @param {"broadcast" | "webrtc" | "websocket"} type
 * @returns {object} transport instance (not yet connected)
 */
export async function createTransport(type) {
  switch (type) {
    case "broadcast": {
      const { BroadcastChannelTransport } = await import("./transport/BroadcastChannelTransport.js");
      return new BroadcastChannelTransport();
    }
    case "webrtc": {
      const { WebRtcTransport } = await import("./transport/WebRtcTransport.js");
      return new WebRtcTransport();
    }
    case "websocket": {
      const { WebSocketTransport } = await import("./transport/WebSocketTransport.js");
      return new WebSocketTransport();
    }
    default:
      throw new Error(`Unknown transport type: "${type}"`);
  }
}
