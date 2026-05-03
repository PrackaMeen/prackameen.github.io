let gameWasmLoadPromise = null;

export function createBoardRuntimeController({
  state,
  gameWasmScriptUrl,
  applyTileDefinitionsFromRuntime,
  renderBoard,
  syncHud
}) {
  return {
    createEmptySession,
    ensureGameWasmRuntime,
    ensureGameWasmHydrated
  };

  function createEmptySession() {
    return {
      boardWidth: 0,
      boardHeight: 0,
      boardOriginX: 0,
      boardOriginY: 0,
      board: [],
      pendingPlacement: null,
      players: []
    };
  }

  async function ensureGameWasmRuntime() {
    if (window.GameWasm?.ready) {
      return window.GameWasm.ready.then(() => window.GameWasm);
    }

    if (!gameWasmLoadPromise) {
      gameWasmLoadPromise = new Promise((resolve, reject) => {
        const existingScript = document.querySelector('script[data-game-wasm-runtime="true"]');
        if (existingScript && window.GameWasm) {
          resolve(window.GameWasm);
          return;
        }

        const script = document.createElement('script');
        script.type = 'module';
        script.src = gameWasmScriptUrl;
        script.dataset.gameWasmRuntime = 'true';
        script.addEventListener('load', () => {
          if (!window.GameWasm?.ready) {
            reject(new Error('GameWasm bridge did not initialize.'));
            return;
          }

          window.GameWasm.ready.then(() => resolve(window.GameWasm)).catch(reject);
        }, { once: true });
        script.addEventListener('error', () => reject(new Error('Failed to load GameWasm bridge.')), { once: true });
        document.head.appendChild(script);
      });
    }

    return gameWasmLoadPromise;
  }

  async function ensureGameWasmHydrated() {
    try {
      const wasm = await ensureGameWasmRuntime();
      const bootstrapSession = state.session || window.__GAME_SESSION__ || null;
      const participants = Array.isArray(bootstrapSession?.players)
        ? bootstrapSession.players.map((player) => ({
            name: player.name || 'Player',
            type: player.type || 'player',
            colorHex: player.colorHex || null,
            isBot: player.type === 'bot',
            role: player.role || 'player'
          }))
        : [];
      const monsterCount = Array.isArray(bootstrapSession?.board)
        ? bootstrapSession.board.filter((cell) => cell?.entityKind === 'monster').length
        : 9;
      const hasParticipants = participants.length > 0;
      const requestedBoardSize = Number.isInteger(bootstrapSession?.boardWidth) && bootstrapSession.boardWidth > 0
        ? bootstrapSession.boardWidth
        : undefined;
      const [runtimeState, runtimeTileDefinitions] = await Promise.all([
        typeof wasm.startGame === 'function' && hasParticipants
          ? wasm.startGame({
              ...(requestedBoardSize ? { boardSize: requestedBoardSize } : {}),
              monsterCount,
              participants
            })
          : wasm.getState(),
        typeof wasm.getTileDefinitions === 'function' ? wasm.getTileDefinitions() : Promise.resolve(null)
      ]);
      const runtimeSnapshot = runtimeState?.snapshot || runtimeState;

      if (runtimeTileDefinitions) {
        applyTileDefinitionsFromRuntime(runtimeTileDefinitions);
      }

      if (runtimeSnapshot?.board) {
        state.isRuntimeReady = true;
        state.session = runtimeSnapshot;
        window.__GAME_SESSION__ = runtimeSnapshot;
        state.activePlayerId = runtimeSnapshot.currentPlayerId ?? runtimeSnapshot.activePlayerId ?? state.activePlayerId;
        state.activePlayerName = runtimeSnapshot.currentPlayerName ?? runtimeSnapshot.activePlayerName ?? state.activePlayerName;
        renderBoard(state.session);
        syncHud();
      }
    } catch {
      state.isRuntimeReady = false;
      state.feedback = 'Game runtime is still loading.';
      syncHud();
    }
  }
}
