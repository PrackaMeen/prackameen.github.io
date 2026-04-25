const STORAGE_KEY = "game.playerPreferences.v1";

export const DEFAULT_PLAYER_PREFERENCES = {
  nickname: "You",
  preferredCharacterId: "random",
  preferredColorId: "random"
};

function normalizeNickname(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) {
    return DEFAULT_PLAYER_PREFERENCES.nickname;
  }

  return trimmed.slice(0, 24);
}

function normalizePreferenceId(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized || "random";
}

function safeReadRawPreferences() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function sanitizePreferences(raw) {
  return {
    nickname: normalizeNickname(raw.nickname),
    preferredCharacterId: normalizePreferenceId(raw.preferredCharacterId),
    preferredColorId: normalizePreferenceId(raw.preferredColorId)
  };
}

export function loadPlayerPreferences() {
  return sanitizePreferences(safeReadRawPreferences());
}

export function savePlayerPreferences(nextPreferences) {
  const merged = {
    ...loadPlayerPreferences(),
    ...(nextPreferences || {})
  };

  const sanitized = sanitizePreferences(merged);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
  } catch {
    // ignore storage errors in private mode/full quota scenarios
  }

  return sanitized;
}

export function clearPlayerPreferences() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore storage errors
  }

  return { ...DEFAULT_PLAYER_PREFERENCES };
}
