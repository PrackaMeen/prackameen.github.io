import assert from 'node:assert/strict';
import test from 'node:test';

import { canExitTowardsTarget, canTraverseBetweenCells } from '../../renderer/board-movement.js';

const normalizeTileKind = (kind) => String(kind || '').toLowerCase();
const getTileWalls = (kind) => {
  if (kind === 'wall-east') {
    return { east: true, west: false, north: false, south: false };
  }

  return { east: false, west: false, north: false, south: false };
};

test('canTraverseBetweenCells accepts open adjacent cells', () => {
  assert.equal(canTraverseBetweenCells(
    { x: 1, y: 1, tileKind: 'road', tileOrientation: 0 },
    { x: 2, y: 1, tileKind: 'road', tileOrientation: 0 },
    { normalizeTileKind, getTileWalls }
  ), true);
});

test('canTraverseBetweenCells rejects blocked adjacent cells', () => {
  assert.equal(canTraverseBetweenCells(
    { x: 1, y: 1, tileKind: 'wall-east', tileOrientation: 0 },
    { x: 2, y: 1, tileKind: 'road', tileOrientation: 0 },
    { normalizeTileKind, getTileWalls }
  ), false);
});

test('canExitTowardsTarget rejects non-adjacent targets', () => {
  assert.equal(canExitTowardsTarget(
    { x: 1, y: 1, tileKind: 'road', tileOrientation: 0 },
    { x: 1, y: 1 },
    { x: 3, y: 1 },
    { normalizeTileKind, getTileWalls, areOrthogonallyAdjacent: () => false }
  ), false);
});