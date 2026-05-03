import assert from 'node:assert/strict';
import test from 'node:test';

import { buildGameBoardDrawPlan } from '../../renderer/game-board-draw-plan.js';

const baseSession = {
  boardWidth: 2,
  boardHeight: 1,
  board: [
    { x: 0, y: 0, tileKind: 'road1', tileOrientation: 0 },
    { x: 1, y: 0, tileKind: 'chamber4', tileOrientation: 3, entityKind: 'player', entityId: 2, tileAnimation: { frameNames: ['chamber4-0', 'chamber4-1'], elapsedMs: 125, frameDurationMs: 100 }, entityAnimation: { frameNames: ['player-0', 'player-1'], elapsedMs: 25, frameDurationMs: 50 } }
  ]
};

test('orders hidden fills before revealed sprites and grid lines last', () => {
  const plan = buildGameBoardDrawPlan({
    session: baseSession,
    boardWidth: 2,
    boardHeight: 1,
    canvasWidth: 200,
    canvasHeight: 100,
    activePlayerId: 2,
    selectedSource: { x: 1, y: 0 },
    isTileRevealed: (_session, x) => x === 1,
    normalizeTileKind: (value) => value,
    normalizeEntityKind: (value) => value,
    getTileSpriteSheetSource: (kind, orientation) => ({ imageUrl: `${kind}:${orientation}`, animation: kind === 'road0' ? { frameNames: ['road0-0', 'road0-1'], elapsedMs: 125, frameDurationMs: 100 } : null }),
    getEntitySpriteSheetSource: (kind, options) => ({ imageUrl: `entity:${kind}:${options?.selected ? 'selected' : 'unselected'}:${options?.orientation ?? 0}` }),
    getEntityOrientation: () => 2
  });

  assert.deepEqual(plan[0], {
    type: 'fill-cell',
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    fillStyle: 'rgba(255, 251, 245, 0.92)',
    column: 0,
    row: 0
  });
  assert.deepEqual(plan[1], {
    type: 'tile-sprite',
    frameName: 'chamber4-1',
    animated: true,
    source: { imageUrl: 'chamber4:3', animation: null },
    x: 100,
    y: 0,
    width: 100,
    height: 100,
    column: 1,
    row: 0,
    tileKind: 'chamber4',
    tileOrientation: 3
  });
  assert.deepEqual(plan[2], {
    type: 'entity-sprite',
    frameName: 'player-0',
    animated: true,
    source: { imageUrl: 'entity:player:selected:2' },
    x: 114,
    y: 14,
    width: 72,
    height: 72,
    column: 1,
    row: 0,
    entityKind: 'player',
    entityOrientation: 2
  });
  assert.equal(plan.at(-1).type, 'grid-line-vertical');
});

test('shows the active player on hidden cells at game start', () => {
  const plan = buildGameBoardDrawPlan({
    session: {
      boardWidth: 1,
      boardHeight: 1,
      board: [{ x: 0, y: 0, tileKind: 'road0', tileOrientation: 0, entityKind: 'player', entityId: 1 }]
    },
    boardWidth: 1,
    boardHeight: 1,
    canvasWidth: 128,
    canvasHeight: 128,
    activePlayerId: 1,
    isTileRevealed: () => false,
    normalizeTileKind: (value) => value,
    normalizeEntityKind: (value) => value,
    getTileSpriteSheetSource: () => ({ imageUrl: 'tile' }),
    getEntitySpriteSheetSource: (kind, options) => ({ imageUrl: `entity:${kind}:${options?.selected ? 'selected' : 'unselected'}:${options?.orientation ?? 0}` }),
    getEntityOrientation: () => 0
  });

  assert.deepEqual(plan[0], {
    type: 'fill-cell',
    x: 0,
    y: 0,
    width: 128,
    height: 128,
    fillStyle: 'rgba(255, 251, 245, 0.92)',
    column: 0,
    row: 0
  });
  assert.deepEqual(plan[1], {
    type: 'entity-sprite',
    frameName: 'default',
    animated: false,
    source: { imageUrl: 'entity:player:selected:0' },
    x: 18,
    y: 18,
    width: 92,
    height: 92,
    column: 0,
    row: 0,
    entityKind: 'player',
    entityOrientation: 0
  });
});

test('uses tile definition animation when a frame is not provided on the cell', () => {
  const plan = buildGameBoardDrawPlan({
    session: {
      boardWidth: 1,
      boardHeight: 1,
      board: [{ x: 0, y: 0, tileKind: 'road0', tileOrientation: 0 }]
    },
    boardWidth: 1,
    boardHeight: 1,
    canvasWidth: 128,
    canvasHeight: 128,
    currentTimeMs: 250,
    isTileRevealed: () => true,
    normalizeTileKind: (value) => value,
    normalizeEntityKind: (value) => value,
    getTileSpriteSheetSource: () => ({
      imageUrl: './assets/game/tiles/Road0/Road0_0.png',
      animation: { frameNames: ['frame-0', 'frame-1', 'frame-2', 'frame-3'], frameDurationMs: 100, loop: true }
    }),
    getEntitySpriteSheetSource: () => ({ imageUrl: 'entity' })
  });

  assert.equal(plan[0].type, 'tile-sprite');
  assert.equal(plan[0].frameName, 'frame-1');
  assert.equal(plan[0].animated, true);
});