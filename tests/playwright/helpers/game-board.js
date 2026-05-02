export function createGameBoardSession(options = {}) {
  const width = options.width ?? 3;
  const height = options.height ?? 3;
  const source = options.source ?? { x: 1, y: 1 };
  const target = options.target ?? { x: 1, y: 0 };
  const revealedTiles = new Map((options.revealedTiles ?? []).map((tile) => [`${tile.x},${tile.y}`, tile]));
  const cells = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      cells.push({
        x,
        y,
        tileKind: options.tileKind ?? 'direct-road',
        tileOrientation: 0
      });
    }
  }

  const sourceCell = getCell(cells, source.x, source.y);
  if (sourceCell) {
    sourceCell.entityKind = 'player';
    sourceCell.entityId = '1';
    sourceCell.entityName = options.playerName ?? 'Player A';
    sourceCell.entityColorHex = options.playerColorHex ?? '#14532d';
  }

  if (options.monster) {
    const monsterCell = getCell(cells, options.monster.x, options.monster.y);
    if (monsterCell) {
      monsterCell.entityKind = 'monster';
      monsterCell.entityId = '2';
      monsterCell.entityName = options.monster.name ?? 'Monster';
      monsterCell.entityColorHex = options.monster.colorHex ?? '#7c2d12';
    }
  }

  if (options.revealedTarget ?? false) {
    revealedTiles.set(`${target.x},${target.y}`, { x: target.x, y: target.y });
  }

  return {
    boardWidth: width,
    boardHeight: height,
    boardOriginX: 0,
    boardOriginY: 0,
    currentPlayerId: 1,
    currentPlayerName: options.playerName ?? 'Player A',
    activePlayerId: 1,
    activePlayerName: options.playerName ?? 'Player A',
    status: 'Runtime ready.',
    board: cells,
    players: [
      {
        id: 1,
        name: options.playerName ?? 'Player A',
        colorHex: options.playerColorHex ?? '#14532d',
        x: source.x,
        y: source.y,
        isAlive: true
      }
    ],
    revealedTiles: Array.from(revealedTiles.values()),
    pendingPlacement: options.pendingPlacement ?? null
  };
}

export async function installGameBoardStub(page, initialSession) {
  await page.addInitScript((sessionData) => {
    const clone = (value) => JSON.parse(JSON.stringify(value));
    const state = clone(sessionData);

    const getCell = (x, y) => state.board.find((cell) => Number(cell.x) === Number(x) && Number(cell.y) === Number(y)) || null;
    const sync = () => {
      const snapshot = clone(state);
      window.__GAME_SESSION__ = snapshot;
      return snapshot;
    };

    const ensurePlayerCell = () => state.board.find((cell) => cell.entityKind === 'player') || null;

    const moveEntity = (sourceX, sourceY, targetX, targetY) => {
      const source = getCell(sourceX, sourceY);
      const target = getCell(targetX, targetY);

      if (!source || !target) {
        return false;
      }

      target.entityKind = source.entityKind;
      target.entityId = source.entityId;
      target.entityName = source.entityName;
      target.entityColorHex = source.entityColorHex;

      delete source.entityKind;
      delete source.entityId;
      delete source.entityName;
      delete source.entityColorHex;

      const player = state.players.find((entry) => String(entry.id) === String(target.entityId));
      if (player) {
        player.x = target.x;
        player.y = target.y;
      }

      state.currentPlayerId = Number(target.entityId || state.currentPlayerId || 1);
      state.currentPlayerName = target.entityName || state.currentPlayerName;
      state.activePlayerId = state.currentPlayerId;
      state.activePlayerName = state.currentPlayerName;
      state.pendingPlacement = null;
      return true;
    };

    const getPlacementTargetCell = () => {
      if (!state.pendingPlacement) {
        return null;
      }

      return getCell(state.pendingPlacement.targetX, state.pendingPlacement.targetY);
    };

    window.__GAME_SESSION__ = sync();
    window.GameWasm = {
      ready: Promise.resolve(),
      async getState() {
        return { snapshot: sync() };
      },
      async startGame() {
        return { success: true, snapshot: sync() };
      },
      async getTileDefinitions() {
        return null;
      },
      async hydrate(session) {
        if (session) {
          Object.assign(state, clone(session));
        }

        return { snapshot: sync() };
      },
      async reset() {
        return { success: true, snapshot: sync() };
      },
      async applyAction(request) {
        const actionName = String(request?.actionName || '').toLowerCase();

        if (actionName === 'move') {
          const moved = moveEntity(request.sourceX, request.sourceY, request.targetX, request.targetY);
          return {
            success: moved,
            message: moved ? 'Move action succeeded' : 'Movement failed.',
            snapshot: sync()
          };
        }

        if (actionName === 'discover') {
          const targetCell = getCell(request.targetX, request.targetY);
          if (!targetCell) {
            return { success: false, message: 'Target not found.', snapshot: sync() };
          }

          const existing = state.revealedTiles.some((tile) => Number(tile.x) === Number(request.targetX) && Number(tile.y) === Number(request.targetY));
          if (!existing) {
            state.revealedTiles.push({ x: Number(request.targetX), y: Number(request.targetY) });
          }

          state.pendingPlacement = {
            actorId: Number(state.currentPlayerId || 1),
            sourceX: Number(request.sourceX),
            sourceY: Number(request.sourceY),
            targetX: Number(request.targetX),
            targetY: Number(request.targetY),
            tileKind: targetCell.tileKind || 'direct-road',
            originalOrientation: Number(targetCell.tileOrientation || 0),
            tileOrientation: Number(targetCell.tileOrientation || 0),
            allowedOrientations: [0, 1, 2, 3],
            entrySide: 'north',
            canCommit: true
          };

          return {
            success: true,
            message: 'Hidden tile preview.',
            snapshot: sync()
          };
        }

        if (actionName === 'rotate_placement') {
          if (!state.pendingPlacement) {
            return { success: false, message: 'No pending placement.', snapshot: sync() };
          }

          const currentOrientation = Number(state.pendingPlacement.tileOrientation ?? 0);
          const nextOrientation = ((currentOrientation + Number(request.rotationDelta || 0)) % 4 + 4) % 4;
          state.pendingPlacement.tileOrientation = nextOrientation;
          state.pendingPlacement.canCommit = true;
          return {
            success: true,
            message: 'Tile rotated.',
            snapshot: sync()
          };
        }

        if (actionName === 'commit_placement') {
          const targetCell = getPlacementTargetCell();
          const sourceCell = state.pendingPlacement ? getCell(state.pendingPlacement.sourceX, state.pendingPlacement.sourceY) : ensurePlayerCell();

          if (!state.pendingPlacement || !targetCell || !sourceCell) {
            return { success: false, message: 'No pending placement.', snapshot: sync() };
          }

          moveEntity(sourceCell.x, sourceCell.y, targetCell.x, targetCell.y);
          state.pendingPlacement = null;
          return {
            success: true,
            message: 'Tile placement committed.',
            snapshot: sync()
          };
        }

        return {
          success: false,
          message: `Unsupported action: ${actionName}`,
          snapshot: sync()
        };
      }
    };
  }, initialSession);
}

function getCell(cells, x, y) {
  return cells.find((cell) => Number(cell.x) === Number(x) && Number(cell.y) === Number(y)) || null;
}