import {
  getEntityAssetUrl,
  getTileAssetUrl,
  getTileWalls,
  normalizeEntityKind,
  normalizeTileKind
} from "../../lib/game-assets.js";

export function mountPage(context) {
  context.setTitle("Single Player / Game");

  const listEl = document.getElementById("gamePlayerList");
  const boardEl = document.getElementById("gameBoard");

  const session = window.__GAME_SESSION__ || createFallbackSession();
  if (!session || !Array.isArray(session.players) || session.players.length === 0) {
    listEl.innerHTML = "<li class=\"game-player-item game-player-item--empty\">No player data available.</li>";
    renderBoard(session);
    return { dispose() {} };
  }

  renderBoard(session);

  session.players.forEach((player) => {
    const li = document.createElement("li");
    li.className = "game-player-item";

    const colorDot = document.createElement("span");
    colorDot.className = "game-player-color";
    if (player.colorHex) {
      colorDot.style.setProperty("--player-color", player.colorHex);
    } else {
      colorDot.classList.add("game-player-color--random");
    }
    colorDot.setAttribute("aria-hidden", "true");

    const icon = document.createElement("span");
    icon.className = "game-player-icon";
    icon.textContent = player.characterIcon;
    icon.setAttribute("aria-hidden", "true");

    const name = document.createElement("span");
    name.className = "game-player-name";
    name.textContent = player.name;

    const badge = document.createElement("span");
    badge.className = `game-player-badge game-player-badge--${player.type}`;
    badge.textContent = player.type === "human" ? "Human" : "Bot";

    li.appendChild(colorDot);
    li.appendChild(icon);
    li.appendChild(name);
    li.appendChild(badge);
    listEl.appendChild(li);
  });

  return { dispose() {} };

  function createFallbackSession() {
    return {
      boardWidth: 6,
      boardHeight: 6,
      board: buildFallbackBoard(),
      players: []
    };
  }

  function buildFallbackBoard() {
    const width = 6;
    const height = 6;
    const cells = [];

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const tileKind = (x === 2 && y === 2)
          ? "cross-road"
          : (x === 2 || y === 2)
            ? "direct-road"
            : ((x < 2 && y < 2) || (x > 3 && y < 2) || (x < 2 && y > 3) || (x > 3 && y > 3))
              ? "chamber-2-entrances"
              : "chamber-4-entrances";

        cells.push({ x, y, tileKind });
      }
    }

    cells[(2 * width) + 2] = {
      ...cells[(2 * width) + 2],
      entityKind: "player",
      entityName: "Player"
    };
    cells[(3 * width) + 3] = {
      ...cells[(3 * width) + 3],
      entityKind: "monster",
      entityName: "Monster"
    };

    return cells;
  }

  function renderBoard(currentSession) {
    if (!boardEl) {
      return;
    }

    const cells = Array.isArray(currentSession?.board) ? currentSession.board : [];
    const width = Number.isInteger(currentSession?.boardWidth) && currentSession.boardWidth > 0
      ? currentSession.boardWidth
      : inferDimension(cells, "x");
    const height = Number.isInteger(currentSession?.boardHeight) && currentSession.boardHeight > 0
      ? currentSession.boardHeight
      : inferDimension(cells, "y");

    boardEl.style.gridTemplateColumns = `repeat(${width}, var(--game-cell-size))`;
    boardEl.innerHTML = "";

    cells.forEach((cell) => {
      const tileKind = normalizeTileKind(cell.tileKind || cell.kind || cell.terrainKind);
      const entityKind = normalizeEntityKind(cell.entityKind || cell.occupantKind || cell.monsterKind || cell.playerKind);
      const hasEntity = Boolean(cell.entityKind || cell.occupantKind || cell.monsterKind || cell.playerKind);
      const tileOrientation = Number.isInteger(cell.tileOrientation)
        ? cell.tileOrientation
        : Number.isInteger(cell.orientation)
          ? cell.orientation
          : 0;
      const tileWalls = getTileWalls(tileKind, tileOrientation);

      const tile = document.createElement("div");
      tile.className = "game-board-cell";
      tile.setAttribute("role", "gridcell");
      tile.dataset.orientation = String(tileOrientation);
      tile.dataset.walls = JSON.stringify(tileWalls);
      tile.title = `${cell.x}, ${cell.y} • ${tileKind} • rot ${tileOrientation * 90}°${hasEntity ? ` • ${entityKind}` : ""}`;

      const terrainLayer = document.createElement("span");
      terrainLayer.className = `game-board-cell__layer game-board-cell__layer--terrain game-board-cell__layer--${tileKind}`;
      terrainLayer.style.backgroundImage = `url(${getTileAssetUrl(tileKind, tileOrientation)})`;

      tile.appendChild(terrainLayer);

      if (hasEntity) {
        const entityLayer = document.createElement("span");
        entityLayer.className = `game-board-cell__layer game-board-cell__layer--entity game-board-cell__layer--${entityKind}`;
        entityLayer.style.backgroundImage = `url(${getEntityAssetUrl(entityKind)})`;
        if (cell.entityColorHex) {
          entityLayer.style.setProperty("--entity-color", cell.entityColorHex);
        }
        tile.appendChild(entityLayer);
      }

      if (cell.entityName) {
        const label = document.createElement("span");
        label.className = "game-board-cell__label";
        label.textContent = cell.entityName;
        tile.appendChild(label);
      }

      boardEl.appendChild(tile);
    });

    if (cells.length !== width * height) {
      const filler = document.createElement("div");
      filler.className = "game-board-cell game-board-cell--warning";
      filler.textContent = "Board payload mismatch.";
      boardEl.appendChild(filler);
    }
  }

  function inferDimension(cells, axis) {
    if (!Array.isArray(cells) || cells.length === 0) {
      return 0;
    }

    return cells.reduce((max, cell) => {
      const value = Number(cell?.[axis] || 0) + 1;
      return value > max ? value : max;
    }, 0);
  }
}
