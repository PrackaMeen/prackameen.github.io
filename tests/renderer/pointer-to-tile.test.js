import assert from 'node:assert/strict';
import test from 'node:test';

import { clampScale, getBoardPointFromCell, getBoardPointFromPointer, getPointerDistance, getPointerMidpoint, getTouchPoint } from '../../renderer/pointer-to-tile.js';

test('reads board coordinates from a cell dataset', () => {
  assert.deepEqual(getBoardPointFromCell({ dataset: { x: '4', y: '7' } }), { x: 4, y: 7 });
  assert.equal(getBoardPointFromCell({ dataset: { x: 'nope', y: '7' } }), null);
});

test('maps pointer coordinates into board coordinates', () => {
  const point = getBoardPointFromPointer({
    boardRect: { left: 100, top: 50, width: 400, height: 200 },
    boardWidth: 4,
    boardHeight: 2,
    boardOriginX: 10,
    boardOriginY: 20,
    cellSize: 100,
    viewportTransform: { scale: 1, panX: 0, panY: 0 },
    clientX: 350,
    clientY: 175
  });

  assert.deepEqual(point, { x: 12, y: 21 });
  assert.equal(getBoardPointFromPointer({ boardRect: { left: 0, top: 0, width: 0, height: 0 }, boardWidth: 4, boardHeight: 2, clientX: 1, clientY: 1 }), null);
});

test('inverts viewport pan when mapping pointer coordinates', () => {
  const point = getBoardPointFromPointer({
    boardRect: { left: 0, top: 0, width: 300, height: 300 },
    boardWidth: 3,
    boardHeight: 3,
    cellSize: 100,
    viewportTransform: { scale: 1, panX: 100, panY: 50 },
    clientX: 150,
    clientY: 150
  });

  assert.deepEqual(point, { x: 0, y: 1 });
});

test('supports touch geometry helpers and scale limits', () => {
  const firstPoint = getTouchPoint({ clientX: 10, clientY: 20 });
  const secondPoint = getTouchPoint({ clientX: 13, clientY: 24 });

  assert.deepEqual(firstPoint, { clientX: 10, clientY: 20 });
  assert.deepEqual(getPointerMidpoint(firstPoint, secondPoint), { clientX: 11.5, clientY: 22 });
  assert.equal(getPointerDistance(firstPoint, secondPoint), 5);
  assert.equal(clampScale(0.2), 0.7);
  assert.equal(clampScale(4), 2.75);
});