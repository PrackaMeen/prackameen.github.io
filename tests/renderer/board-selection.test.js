import assert from 'node:assert/strict';
import test from 'node:test';

import { areOrthogonallyAdjacent, classifyTargetPreview } from '../../renderer/board-selection.js';

test('areOrthogonallyAdjacent returns true for cardinal neighbors only', () => {
  assert.equal(areOrthogonallyAdjacent({ x: 1, y: 1 }, { x: 1, y: 2 }), true);
  assert.equal(areOrthogonallyAdjacent({ x: 1, y: 1 }, { x: 2, y: 2 }), false);
  assert.equal(areOrthogonallyAdjacent({ x: 1, y: 1 }, null), false);
});

test('classifyTargetPreview returns a green hidden-tile preview when the source edge is open', () => {
  const session = {
    board: [
      { x: 1, y: 1, tileKind: 'road', tileOrientation: 0 },
      { x: 1, y: 2, tileKind: 'road', tileOrientation: 0 }
    ]
  };

  assert.deepEqual(classifyTargetPreview({
    currentSession: session,
    source: { x: 1, y: 1 },
    target: { x: 1, y: 2 },
    isTileRevealed: () => false,
    getBoardCell: (currentSession, x, y) => currentSession.board.find((cell) => cell.x === x && cell.y === y) || null,
    canExitTowardsTarget: () => true,
    canTraverseBetweenCells: () => false,
    isTargetEngaged: () => false
  }), {
    tone: 'green',
    color: '#14532d',
    message: 'Hidden tile preview.'
  });
});

test('classifyTargetPreview blocks revealed movement when walls close the path', () => {
  const session = {
    board: [
      { x: 1, y: 1, tileKind: 'road', tileOrientation: 0 },
      { x: 1, y: 2, tileKind: 'road', tileOrientation: 0 }
    ]
  };

  assert.deepEqual(classifyTargetPreview({
    currentSession: session,
    source: { x: 1, y: 1 },
    target: { x: 1, y: 2 },
    isTileRevealed: () => true,
    getBoardCell: (currentSession, x, y) => currentSession.board.find((cell) => cell.x === x && cell.y === y) || null,
    canExitTowardsTarget: () => true,
    canTraverseBetweenCells: () => false,
    isTargetEngaged: () => true
  }), {
    tone: 'red',
    color: '#b91c1c',
    message: 'Movement is blocked by walls.'
  });
});