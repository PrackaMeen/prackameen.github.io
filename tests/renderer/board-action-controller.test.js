import assert from 'node:assert/strict';
import test from 'node:test';

import { createBoardActionController } from '../../renderer/board-action-controller.js';

test('successful place-and-move recenters the camera through the viewport controller', async () => {
  const originalWindow = globalThis.window;
  globalThis.window = {};
  try {
    const calls = [];
    const state = {
      isSubmitting: false,
      feedback: '',
      pendingPlacement: {
        sourceX: 1,
        sourceY: 1,
        targetX: 1,
        targetY: 2,
        canCommit: true,
        tileKind: 'road',
        tileOrientation: 0
      },
      session: {
        pendingPlacement: {
          sourceX: 1,
          sourceY: 1,
          targetX: 1,
          targetY: 2,
          canCommit: true,
          tileKind: 'road',
          tileOrientation: 0
        }
      },
      selectedSource: { x: 1, y: 1 },
      pendingTarget: { x: 1, y: 2 },
      activePlayerId: 'player-1',
      activePlayerName: 'Player One'
    };

    const controller = createBoardActionController({
      state,
      boardRuntime: {
        ensureGameWasmRuntime: async () => ({
          applyAction: async () => ({
            success: true,
            message: 'Moved',
            snapshot: {
              currentPlayerId: 'player-1',
              currentPlayerName: 'Player One',
              boardWidth: 4,
              boardHeight: 4,
              board: [],
              pendingPlacement: null
            }
          })
        })
      },
      boardViewport: {
        centerCameraOnActivePlayer(session) {
          calls.push(['center', session]);
          calls.push(['render', session]);
        }
      },
      boardHud: {
        syncHud() {
          calls.push(['hud']);
        }
      },
      boardInteraction: {
        clearSelection() {
          calls.push(['clear']);
          state.selectedSource = null;
          state.pendingTarget = null;
        }
      },
      renderBoard(session) {
        calls.push(['render', session]);
      },
      isTileRevealed() {
        return false;
      }
    });

    await controller.handlePerformAction();

    assert.equal(calls.some(([kind]) => kind === 'center'), true);
    assert.equal(calls.some(([kind]) => kind === 'render'), true);
    assert.equal(state.isSubmitting, false);
    assert.equal(state.session.pendingPlacement, null);
  } finally {
    globalThis.window = originalWindow;
  }
});