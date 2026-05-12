import assert from 'node:assert/strict';
import test from 'node:test';

import { createBoardRenderController } from '../../renderer/board-render-controller.js';

function createHarness(stateOverrides = {}) {
  const calls = [];
  const state = {
    boardWidth: 0,
    boardHeight: 0,
    boardOriginX: 0,
    boardOriginY: 0,
    pendingPlacement: null,
    selectedSource: { x: 1, y: 1 },
    pendingTarget: { x: 1, y: 2 },
    selectionPreviewTone: { tone: 'green' },
    hasInitialCameraCenterApplied: false,
    ...stateOverrides
  };

  const controller = createBoardRenderController({
    state,
    mapEl: {},
    boardViewport: {
      lockBoardCellSize(width, height) {
        calls.push(['lock', width, height]);
      },
      centerCameraOnActivePlayer(session) {
        calls.push(['center', session]);
      }
    },
    gameBoardCanvas: {
      render(session) {
        calls.push(['render', session]);
      }
    }
  });

  return { controller, state, calls };
}

test('syncs board dimensions and renders through the canvas', () => {
  const { controller, state, calls } = createHarness();
  const session = {
    boardWidth: 4,
    boardHeight: 3,
    boardOriginX: 2,
    boardOriginY: 5,
    pendingPlacement: null
  };

  controller.renderBoard(session);

  assert.equal(state.boardWidth, 4);
  assert.equal(state.boardHeight, 3);
  assert.equal(state.boardOriginX, 2);
  assert.equal(state.boardOriginY, 5);
  assert.deepEqual(calls, [
    ['lock', 4, 3],
    ['center', session],
    ['render', session]
  ]);
});

test('clears selection state when a pending placement exists', () => {
  const { controller, state } = createHarness();
  const session = {
    boardWidth: 4,
    boardHeight: 4,
    pendingPlacement: {
      sourceX: 1,
      sourceY: 1,
      targetX: 1,
      targetY: 2
    }
  };

  controller.renderBoard(session);

  assert.equal(state.pendingPlacement, session.pendingPlacement);
  assert.equal(state.selectedSource, null);
  assert.equal(state.pendingTarget, null);
  assert.equal(state.selectionPreviewTone, null);
});

test('does not recenter the camera more than once', () => {
  const { controller, calls } = createHarness({ hasInitialCameraCenterApplied: true });
  const session = {
    boardWidth: 4,
    boardHeight: 4,
    pendingPlacement: null
  };

  controller.renderBoard(session);

  assert.deepEqual(calls, [
    ['lock', 4, 4],
    ['render', session]
  ]);
});

test('renders zero-sized sessions without locking or centering', () => {
  const { controller, calls } = createHarness();
  const session = {
    boardWidth: 0,
    boardHeight: 0,
    pendingPlacement: null
  };

  controller.renderBoard(session);

  assert.deepEqual(calls, [
    ['render', session]
  ]);
});
