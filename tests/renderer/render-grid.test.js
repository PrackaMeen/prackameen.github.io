import assert from 'node:assert/strict';
import test from 'node:test';

import { getCanvasSize, getCellBounds, getGridLinePositions } from '../../renderer/render-grid.js';

test('normalizes canvas size to whole positive pixels', () => {
  assert.deepEqual(getCanvasSize({ width: 319.2, height: 0 }), { width: 319, height: 1 });
});

test('computes cell bounds from board geometry', () => {
  assert.deepEqual(
    getCellBounds({ column: 1, row: 2, boardWidth: 4, boardHeight: 6, canvasWidth: 400, canvasHeight: 600 }),
    { x: 100, y: 200, width: 100, height: 100 }
  );
});

test('returns matching grid line positions for the full board', () => {
  assert.deepEqual(
    getGridLinePositions({ boardWidth: 2, boardHeight: 2, canvasWidth: 200, canvasHeight: 200 }),
    { horizontal: [0.5, 100.5, 200.5], vertical: [0.5, 100.5, 200.5] }
  );
});