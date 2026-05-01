const DEFAULT_API_BASE_URL = "https://prackameen-game-d4gqengkdwggbgcd.westeurope-01.azurewebsites.net/api";
const API_BASE_STORAGE_KEY = "game-room-api-base-url";

export class RoomApiClient {
  constructor(apiBaseUrl = null) {
    this._apiBaseUrl = normalizeApiBaseUrl(
      apiBaseUrl || loadStoredApiBaseUrl() || DEFAULT_API_BASE_URL
    );
  }

  get apiBaseUrl() {
    return this._apiBaseUrl;
  }

  setApiBaseUrl(apiBaseUrl) {
    this._apiBaseUrl = normalizeApiBaseUrl(apiBaseUrl);

    try {
      localStorage.setItem(API_BASE_STORAGE_KEY, this._apiBaseUrl);
    } catch {
      // Storage is optional; continue with the in-memory value if it fails.
    }

    return this._apiBaseUrl;
  }

  async createRoom(hostName) {
    return await this._request("POST", "/rooms", { hostName });
  }

  async getRoom(roomId) {
    return await this._request("GET", `/rooms/${encodeURIComponent(roomId)}`);
  }

  async joinRoom(roomId, playerName) {
    return await this._request("POST", `/rooms/${encodeURIComponent(roomId)}/join`, { playerName });
  }

  async heartbeat(roomId, playerId) {
    return await this._request("POST", `/rooms/${encodeURIComponent(roomId)}/heartbeat`, { playerId });
  }

  async _request(method, path, body) {
    const response = await fetch(`${this._apiBaseUrl}${path}`, {
      method,
      mode: "cors",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined
    });

    const payload = await readJsonResponse(response);
    if (!response.ok) {
      const message = payload?.message || payload?.error || `Request failed (${response.status})`;
      throw new Error(message);
    }

    return payload;
  }
}

export function buildRoomJoinCode({ roomId, apiBaseUrl }) {
  const payload = {
    r: String(roomId || "").trim(),
    b: normalizeApiBaseUrl(apiBaseUrl)
  };

  return btoa(JSON.stringify(payload));
}

export function parseRoomJoinCode(rawJoinCode) {
  const normalized = String(rawJoinCode || "").trim();
  if (!normalized) {
    throw new Error("Join code is required.");
  }

  const payload = normalized.startsWith("GAMEJOIN:")
    ? normalized.slice("GAMEJOIN:".length).trim()
    : normalized;

  let decoded = null;
  try {
    decoded = JSON.parse(atob(payload));
  } catch {
    decoded = null;
  }

  if (decoded && typeof decoded === "object") {
    const roomId = String(decoded.r || decoded.roomId || "").trim();
    const apiBaseUrl = typeof decoded.b === "string"
      ? normalizeApiBaseUrl(decoded.b)
      : typeof decoded.apiBaseUrl === "string"
        ? normalizeApiBaseUrl(decoded.apiBaseUrl)
        : "";

    if (roomId) {
      return { roomId, apiBaseUrl };
    }
  }

  return { roomId: payload, apiBaseUrl: "" };
}

export function normalizeApiBaseUrl(apiBaseUrl) {
  const raw = String(apiBaseUrl || "").trim();
  if (!raw) {
    throw new Error("API base URL is required.");
  }

  try {
    return new URL(raw).toString().replace(/\/$/, "");
  } catch {
    throw new Error(`Invalid API base URL: ${raw}`);
  }
}

export function loadStoredApiBaseUrl() {
  try {
    return localStorage.getItem(API_BASE_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

function readJsonResponse(response) {
  return response.text().then((text) => {
    if (!text) {
      return null;
    }

    try {
      return JSON.parse(text);
    } catch {
      return { message: text };
    }
  });
}