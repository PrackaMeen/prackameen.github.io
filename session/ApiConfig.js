const DEFAULT_REMOTE_API_BASE_URL = "https://prackameen-game-d4gqengkdwggbgcd.westeurope-01.azurewebsites.net/api";
const DEFAULT_LOCAL_API_BASE_URL = "http://localhost:7071/api";
const API_BASE_STORAGE_KEY = "game-room-api-base-url";
const ROOM_JOIN_CODE_PREFIX = "GAMEJOIN:";
const HEARTBEAT_INTERVAL_MS = 15_000;
const POLL_INTERVAL_MS = 4_000;

export {
  DEFAULT_REMOTE_API_BASE_URL,
  DEFAULT_LOCAL_API_BASE_URL,
  API_BASE_STORAGE_KEY,
  ROOM_JOIN_CODE_PREFIX,
  HEARTBEAT_INTERVAL_MS,
  POLL_INTERVAL_MS
};

export function getDefaultApiBaseUrl() {
  if (typeof window !== "undefined") {
    const hostname = String(window.location.hostname || "").toLowerCase();
    const protocol = String(window.location.protocol || "").toLowerCase();

    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || protocol === "file:") {
      return DEFAULT_LOCAL_API_BASE_URL;
    }
  }

  return DEFAULT_REMOTE_API_BASE_URL;
}