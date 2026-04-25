import { loadPlayerPreferences } from "../../player-preferences.js";

export function mountPage(context) {
  context.setTitle("Multiplayer");

  const nicknameEl = document.getElementById("profileNickname");
  const characterEl = document.getElementById("profileCharacter");
  const colorEl = document.getElementById("profileColor");

  const prefs = loadPlayerPreferences();
  nicknameEl.textContent = prefs.nickname;
  characterEl.textContent = prefs.preferredCharacterId === "random"
    ? "Random"
    : prefs.preferredCharacterId;
  colorEl.textContent = prefs.preferredColorId === "random"
    ? "Random"
    : prefs.preferredColorId;

  return { dispose() {} };
}
