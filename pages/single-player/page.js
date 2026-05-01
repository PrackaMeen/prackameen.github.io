import { loadPlayerPreferences } from "../../player-preferences.js";

export function mountPage(context) {
  context.setTitle("Single Player");

  const listEl = document.getElementById("playerList");
  const addBtn = document.getElementById("addPlayerBtn");
  const startBtn = document.getElementById("startGameBtn");

  const fallbackClasses = [
    { id: "vanguard", name: "Vanguard", icon: "🛡️" },
    { id: "ranger", name: "Ranger", icon: "🏹" },
    { id: "mystic", name: "Mystic", icon: "✨" },
    { id: "engineer", name: "Engineer", icon: "🔧" },
    { id: "shadow", name: "Shadow", icon: "🗡️" }
  ];

  const colorPalette = [
    { id: "red", label: "Red", hex: "#c44634" },
    { id: "blue", label: "Blue", hex: "#2e6fc8" },
    { id: "green", label: "Green", hex: "#2f9148" },
    { id: "brown", label: "Brown", hex: "#8a5c35" },
    { id: "yellow", label: "Yellow", hex: "#d4a017" },
    { id: "orange", label: "Orange", hex: "#d4621a" },
    { id: "black", label: "Black", hex: "#222222" },
    { id: "purple", label: "Purple", hex: "#7b3fa0" }
  ];

  const RANDOM_CHARACTER = { id: "random", name: "Random", icon: "🎲" };
  const RANDOM_COLOR = { id: "random", label: "Random", hex: null };

  const preferences = loadPlayerPreferences();

  const players = [{
    id: 1,
    name: preferences.nickname,
    type: "human",
    removable: false,
    characterId: preferences.preferredCharacterId,
    colorId: preferences.preferredColorId
  }];
  let characterClasses = fallbackClasses;
  let nextId = 2;
  let characterSelectorOpenForPlayerId = null;
  let colorSelectorOpenForPlayerId = null;

  function getCharacterClass(characterId) {
    if (characterId === "random") {
      return RANDOM_CHARACTER;
    }

    return characterClasses.find((item) => item.id === characterId) || RANDOM_CHARACTER;
  }

  function getColorDefinition(colorId) {
    if (colorId === "random") {
      return RANDOM_COLOR;
    }

    return colorPalette.find((item) => item.id === colorId) || RANDOM_COLOR;
  }

  function getUsedColorIds(excludePlayerId = null) {
    return new Set(
      players
        .filter((player) => player.id !== excludePlayerId && player.colorId && player.colorId !== "random")
        .map((player) => player.colorId)
    );
  }

  function syncAddButtonState() {
    addBtn.disabled = players.length >= colorPalette.length;
  }

  function sanitizePreferredCharacterId(characterId) {
    if (characterId === "random") {
      return "random";
    }

    return characterClasses.some((item) => item.id === characterId) ? characterId : "random";
  }

  function sanitizePreferredColorId(colorId) {
    if (colorId === "random") {
      return "random";
    }

    return colorPalette.some((item) => item.id === colorId) ? colorId : "random";
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

  async function fetchRandomCharacterId() {
    try {
      const response = await fetch("/api/characters/random-default");
      if (!response.ok) {
        return characterClasses[Math.floor(Math.random() * characterClasses.length)].id;
      }

      const payload = await response.json();
      const found = characterClasses.find((item) => item.id === payload?.characterId);
      return found ? found.id : characterClasses[Math.floor(Math.random() * characterClasses.length)].id;
    } catch {
      return characterClasses[Math.floor(Math.random() * characterClasses.length)].id;
    }
  }

  function renderPlayers() {
    listEl.innerHTML = "";
    players.forEach((player) => {
      const li = document.createElement("li");
      li.className = "player-item";
      li.dataset.playerId = player.id;

      const selectedClass = getCharacterClass(player.characterId);
      const selectedColor = getColorDefinition(player.colorId);

      const icon = document.createElement("button");
      icon.className = "character-icon-btn";
      icon.type = "button";
      icon.dataset.id = String(player.id);
      icon.setAttribute("aria-label", `Change ${player.name} character`);

      const iconGlyph = document.createElement("span");
      iconGlyph.className = "character-icon";
      iconGlyph.setAttribute("aria-hidden", "true");
      iconGlyph.textContent = selectedClass.icon;

      icon.appendChild(iconGlyph);

      const name = document.createElement("span");
      name.className = "player-name";
      name.textContent = player.name;

      const badge = document.createElement("span");
      badge.className = `player-badge player-badge--${player.type}`;
      badge.textContent = player.type === "human" ? "Human" : "Bot";

      const colorBtn = document.createElement("button");
      colorBtn.className = "color-chip-btn";
      colorBtn.type = "button";
      colorBtn.dataset.id = String(player.id);
      colorBtn.setAttribute("aria-label", `Change ${player.name} color`);

      const colorSwatch = document.createElement("span");
      colorSwatch.className = selectedColor.hex
        ? "color-chip-swatch"
        : "color-chip-swatch color-chip-swatch--random";
      if (selectedColor.hex) {
        colorSwatch.style.setProperty("--player-color", selectedColor.hex);
      }
      colorSwatch.setAttribute("aria-hidden", "true");

      const colorLabel = document.createElement("span");
      colorLabel.className = "color-chip-label";
      colorLabel.textContent = selectedColor.label;

      colorBtn.appendChild(colorSwatch);
      colorBtn.appendChild(colorLabel);

      li.appendChild(colorBtn);
      li.appendChild(icon);
      li.appendChild(name);
      li.appendChild(badge);

      if (player.removable) {
        const removeBtn = document.createElement("button");
        removeBtn.className = "player-remove-btn";
        removeBtn.dataset.id = String(player.id);
        removeBtn.type = "button";
        removeBtn.setAttribute("aria-label", `Remove ${player.name}`);
        removeBtn.textContent = "x";
        li.appendChild(removeBtn);
      }

      if (characterSelectorOpenForPlayerId === player.id) {
        const popover = document.createElement("div");
        popover.className = "selector-popover selector-popover--character";
        popover.dataset.id = String(player.id);

        // Random option first
        const randomOptBtn = document.createElement("button");
        randomOptBtn.type = "button";
        randomOptBtn.className = "character-option-btn";
        randomOptBtn.dataset.playerId = String(player.id);
        randomOptBtn.dataset.characterId = "random";
        if (player.characterId === "random") {
          randomOptBtn.classList.add("is-selected");
        }
        randomOptBtn.textContent = `${RANDOM_CHARACTER.icon} ${RANDOM_CHARACTER.name}`;
        popover.appendChild(randomOptBtn);

        characterClasses.forEach((characterClass) => {
          const optionBtn = document.createElement("button");
          optionBtn.type = "button";
          optionBtn.className = "character-option-btn";
          optionBtn.dataset.playerId = String(player.id);
          optionBtn.dataset.characterId = characterClass.id;
          if (characterClass.id === selectedClass.id) {
            optionBtn.classList.add("is-selected");
          }
          optionBtn.textContent = `${characterClass.icon} ${characterClass.name}`;
          popover.appendChild(optionBtn);
        });

        li.appendChild(popover);
      }

      if (colorSelectorOpenForPlayerId === player.id) {
        const popover = document.createElement("div");
        popover.className = "selector-popover selector-popover--color";
        popover.dataset.id = String(player.id);

        const usedColors = getUsedColorIds(player.id);

        // Random option first
        const randomColorOptBtn = document.createElement("button");
        randomColorOptBtn.type = "button";
        randomColorOptBtn.className = "color-option-btn";
        randomColorOptBtn.dataset.playerId = String(player.id);
        randomColorOptBtn.dataset.colorId = "random";
        if (player.colorId === "random") {
          randomColorOptBtn.classList.add("is-selected");
        }

        const randomSwatch = document.createElement("span");
        randomSwatch.className = "color-option-swatch color-option-swatch--random";
        randomSwatch.setAttribute("aria-hidden", "true");

        const randomLabel = document.createElement("span");
        randomLabel.className = "color-option-label";
        randomLabel.textContent = "Random";

        randomColorOptBtn.appendChild(randomSwatch);
        randomColorOptBtn.appendChild(randomLabel);
        popover.appendChild(randomColorOptBtn);

        colorPalette.forEach((colorDef) => {
          const optionBtn = document.createElement("button");
          optionBtn.type = "button";
          optionBtn.className = "color-option-btn";
          optionBtn.dataset.playerId = String(player.id);
          optionBtn.dataset.colorId = colorDef.id;

          if (player.colorId === colorDef.id) {
            optionBtn.classList.add("is-selected");
          }

          if (usedColors.has(colorDef.id) && player.colorId !== colorDef.id) {
            optionBtn.disabled = true;
          }

          const swatch = document.createElement("span");
          swatch.className = "color-option-swatch";
          swatch.style.setProperty("--player-color", colorDef.hex);
          swatch.setAttribute("aria-hidden", "true");

          const label = document.createElement("span");
          label.className = "color-option-label";
          label.textContent = colorDef.label;

          optionBtn.appendChild(swatch);
          optionBtn.appendChild(label);
          popover.appendChild(optionBtn);
        });

        li.appendChild(popover);
      }

      listEl.appendChild(li);
    });

    listEl.querySelectorAll(".character-icon-btn").forEach((buttonEl) => {
      buttonEl.addEventListener("click", (event) => {
        event.stopPropagation();
        const id = Number(buttonEl.dataset.id);
        colorSelectorOpenForPlayerId = null;
        characterSelectorOpenForPlayerId = characterSelectorOpenForPlayerId === id ? null : id;
        renderPlayers();
      });
    });

    listEl.querySelectorAll(".color-chip-btn").forEach((buttonEl) => {
      buttonEl.addEventListener("click", (event) => {
        event.stopPropagation();
        const id = Number(buttonEl.dataset.id);
        characterSelectorOpenForPlayerId = null;
        colorSelectorOpenForPlayerId = colorSelectorOpenForPlayerId === id ? null : id;
        renderPlayers();
      });
    });

    listEl.querySelectorAll(".character-option-btn").forEach((buttonEl) => {
      buttonEl.addEventListener("click", () => {
        const playerId = Number(buttonEl.dataset.playerId);
        const player = players.find((item) => item.id === playerId);
        if (!player) {
          return;
        }

        player.characterId = buttonEl.dataset.characterId;
        characterSelectorOpenForPlayerId = null;
        renderPlayers();
      });
    });

    listEl.querySelectorAll(".color-option-btn").forEach((buttonEl) => {
      buttonEl.addEventListener("click", () => {
        const playerId = Number(buttonEl.dataset.playerId);
        const player = players.find((item) => item.id === playerId);
        if (!player) {
          return;
        }

        player.colorId = buttonEl.dataset.colorId;
        colorSelectorOpenForPlayerId = null;
        renderPlayers();
      });
    });

    listEl.querySelectorAll(".player-remove-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = Number(btn.dataset.id);
        const idx = players.findIndex((p) => p.id === id);
        if (idx !== -1) {
          if (characterSelectorOpenForPlayerId === id) {
            characterSelectorOpenForPlayerId = null;
          }
          if (colorSelectorOpenForPlayerId === id) {
            colorSelectorOpenForPlayerId = null;
          }
          players.splice(idx, 1);
          reNumberPlayers();
          renderPlayers();
          syncAddButtonState();
        }
      });
    });
  }

  function reNumberPlayers() {
    players.forEach((p, i) => {
      if (p.removable) {
        p.name = `Player ${i + 1}`;
      }
    });
  }

  async function addPlayer() {
    players.push({
      id: nextId,
      name: `Player ${players.length + 1}`,
      type: "bot",
      removable: true,
      characterId: "random",
      colorId: "random"
    });
    characterSelectorOpenForPlayerId = null;
    colorSelectorOpenForPlayerId = null;
    nextId += 1;
    renderPlayers();
    syncAddButtonState();
  }

  async function initialize() {
    addBtn.disabled = true;
    characterClasses = await fetchCharacterClasses();
    players[0].characterId = sanitizePreferredCharacterId(players[0].characterId);
    players[0].colorId = sanitizePreferredColorId(players[0].colorId);
    renderPlayers();
    syncAddButtonState();
  }

  function handleAddPlayerClick() {
    addBtn.disabled = true;
    addPlayer().finally(() => {
      syncAddButtonState();
    });
  }

  function handleDocumentClick(event) {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    if (
      target.closest(".selector-popover") ||
      target.closest(".character-icon-btn") ||
      target.closest(".color-chip-btn")
    ) {
      return;
    }

    if (characterSelectorOpenForPlayerId !== null || colorSelectorOpenForPlayerId !== null) {
      characterSelectorOpenForPlayerId = null;
      colorSelectorOpenForPlayerId = null;
      renderPlayers();
    }
  }

  addBtn.addEventListener("click", handleAddPlayerClick);
  document.addEventListener("click", handleDocumentClick);

  function handleStartGame() {
    const RANDOM_COLOR_HEX = null;
    const board = buildDemoBoard(players);
    window.__GAME_SESSION__ = {
      boardWidth: board.width,
      boardHeight: board.height,
      board: board.cells,
      players: players.map((player) => ({
        id: player.id,
        name: player.name,
        type: player.type,
        characterIcon: player.characterId === "random"
          ? RANDOM_CHARACTER.icon
          : (characterClasses.find((c) => c.id === player.characterId)?.icon ?? RANDOM_CHARACTER.icon),
        colorHex: player.colorId === "random"
          ? RANDOM_COLOR_HEX
          : (colorPalette.find((c) => c.id === player.colorId)?.hex ?? RANDOM_COLOR_HEX)
      }))
    };
    context.setRoute("single-player-game");
  }

  function buildDemoBoard(currentPlayers) {
    const width = 6;
    const height = 6;
    const cells = [];

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        let tileKind = "cross-road";

        if (x === 2 && y === 2) {
          tileKind = "cross-road";
        } else if (x === 2 || y === 2) {
          tileKind = "direct-road";
        } else if ((x < 2 && y < 2) || (x > 3 && y < 2) || (x < 2 && y > 3) || (x > 3 && y > 3)) {
          tileKind = "chamber-2-entrances";
        } else {
          tileKind = "chamber-4-entrances";
        }

        cells.push({ x, y, tileKind });
      }
    }

    const playerName = currentPlayers[0]?.name || "Player";
    const playerColorHex = currentPlayers[0]?.colorHex || null;

    setCellEntity(cells, width, 2, 2, {
      entityKind: "player",
      entityName: playerName,
      entityColorHex: playerColorHex
    });

    setCellEntity(cells, width, 3, 3, {
      entityKind: "monster",
      entityName: "Monster",
      entityColorHex: "#b91c1c"
    });

    if (currentPlayers[1]) {
      setCellEntity(cells, width, 4, 2, {
        entityKind: "player",
        entityName: currentPlayers[1].name || "Player 2",
        entityColorHex: currentPlayers[1].colorHex || null
      });
    }

    return { width, height, cells };
  }

  function setCellEntity(cells, width, x, y, entity) {
    const index = (y * width) + x;
    if (index < 0 || index >= cells.length) {
      return;
    }

    cells[index] = {
      ...cells[index],
      ...entity
    };
  }

  startBtn.addEventListener("click", handleStartGame);

  initialize();

  return {
    dispose() {
      addBtn.disabled = false;
      addBtn.removeEventListener("click", handleAddPlayerClick);
      document.removeEventListener("click", handleDocumentClick);
      startBtn.removeEventListener("click", handleStartGame);
    }
  };
}
