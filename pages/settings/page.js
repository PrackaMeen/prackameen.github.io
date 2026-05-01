import {
  DEFAULT_PLAYER_PREFERENCES,
  clearPlayerPreferences,
  loadPlayerPreferences,
  savePlayerPreferences
} from "../../player-preferences.js";

const fallbackClasses = [
  { id: "vanguard", name: "Vanguard", icon: "Shield" },
  { id: "ranger", name: "Ranger", icon: "Bow" },
  { id: "mystic", name: "Mystic", icon: "Spark" },
  { id: "engineer", name: "Engineer", icon: "Wrench" },
  { id: "shadow", name: "Shadow", icon: "Blade" }
];

const colorPalette = [
  { id: "red", label: "Red" },
  { id: "blue", label: "Blue" },
  { id: "green", label: "Green" },
  { id: "brown", label: "Brown" },
  { id: "yellow", label: "Yellow" },
  { id: "orange", label: "Orange" },
  { id: "black", label: "Black" },
  { id: "purple", label: "Purple" }
];

function validateCharacterId(preferredCharacterId, characterClasses) {
  if (preferredCharacterId === "random") {
    return "random";
  }

  return characterClasses.some((item) => item.id === preferredCharacterId)
    ? preferredCharacterId
    : "random";
}

function validateColorId(preferredColorId) {
  if (preferredColorId === "random") {
    return "random";
  }

  return colorPalette.some((item) => item.id === preferredColorId)
    ? preferredColorId
    : "random";
}

async function fetchCharacterClasses() {
  try {
    const response = await fetch("/api/characters/classes");
    if (!response.ok) {
      return fallbackClasses;
    }

    const payload = await response.json();
    if (!Array.isArray(payload?.items) || payload.items.length === 0) {
      return fallbackClasses;
    }

    return payload.items;
  } catch {
    return fallbackClasses;
  }
}

export function mountPage(context) {
  context.setTitle("Settings");

  const form = document.getElementById("playerPrefsForm");
  const nicknameInput = document.getElementById("nicknameInput");
  const characterSelect = document.getElementById("characterSelect");
  const colorSelect = document.getElementById("colorSelect");
  const resetBtn = document.getElementById("resetPrefsBtn");
  const feedback = document.getElementById("settingsFeedback");

  let characterClasses = fallbackClasses;

  function setFeedback(message) {
    feedback.textContent = message;
  }

  function renderColorOptions(selectedId) {
    colorSelect.innerHTML = "";

    const randomOption = document.createElement("option");
    randomOption.value = "random";
    randomOption.textContent = "Random";
    colorSelect.appendChild(randomOption);

    colorPalette.forEach((color) => {
      const option = document.createElement("option");
      option.value = color.id;
      option.textContent = color.label;
      colorSelect.appendChild(option);
    });

    colorSelect.value = validateColorId(selectedId);
  }

  function renderCharacterOptions(selectedId) {
    characterSelect.innerHTML = "";

    const randomOption = document.createElement("option");
    randomOption.value = "random";
    randomOption.textContent = "Random";
    characterSelect.appendChild(randomOption);

    characterClasses.forEach((characterClass) => {
      const option = document.createElement("option");
      option.value = characterClass.id;
      option.textContent = `${characterClass.name} (${characterClass.icon})`;
      characterSelect.appendChild(option);
    });

    characterSelect.value = validateCharacterId(selectedId, characterClasses);
  }

  function hydrateForm(preferences) {
    nicknameInput.value = preferences.nickname ?? DEFAULT_PLAYER_PREFERENCES.nickname;
    renderCharacterOptions(preferences.preferredCharacterId);
    renderColorOptions(preferences.preferredColorId);
  }

  function handleSave(event) {
    event.preventDefault();

    const saved = savePlayerPreferences({
      nickname: nicknameInput.value,
      preferredCharacterId: validateCharacterId(characterSelect.value, characterClasses),
      preferredColorId: validateColorId(colorSelect.value)
    });

    hydrateForm(saved);
    setFeedback("Saved. These defaults will load in Single Player and Multiplayer.");
  }

  function handleReset() {
    const defaults = clearPlayerPreferences();
    hydrateForm(defaults);
    setFeedback("Preferences reset to defaults.");
  }

  form.addEventListener("submit", handleSave);
  resetBtn.addEventListener("click", handleReset);

  const initialPrefs = loadPlayerPreferences();
  fetchCharacterClasses()
    .then((items) => {
      characterClasses = items;
      hydrateForm(initialPrefs);
    })
    .catch(() => {
      hydrateForm(initialPrefs);
    });

  return {
    dispose() {
      form.removeEventListener("submit", handleSave);
      resetBtn.removeEventListener("click", handleReset);
    }
  };
}
