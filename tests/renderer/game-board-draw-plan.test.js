import assert from 'node:assert/strict';
import test from 'node:test';

import { buildGameBoardDrawPlan } from '../../renderer/game-board-draw-plan.js';

const baseSession = {
  boardWidth: 2,
  boardHeight: 1,
  board: [
    { x: 0, y: 0, tileKind: 'road1', tileOrientation: 0 },
    { x: 1, y: 0, tileKind: 'chamber4', tileOrientation: 3, entityKind: 'player', tileAnimation: { frameNames: ['chamber4-0', 'chamber4-1'], elapsedMs: 125, frameDurationMs: 100 }, entityAnimation: { frameNames: ['player-0', 'player-1'], elapsedMs: 25, frameDurationMs: 50 } }
  ]
};

test('orders hidden fills before revealed sprites and grid lines last', () => {
  const plan = buildGameBoardDrawPlan({
    session: baseSession,
    boardWidth: 2,
    boardHeight: 1,
    canvasWidth: 200,
    canvasHeight: 100,
    isTileRevealed: (_session, x) => x === 1,
    normalizeTileKind: (value) => value,
    normalizeEntityKind: (value) => value,
    getTileSpriteSheetSource: (kind, orientation) => ({ imageUrl: `${kind}:${orientation}` }),
    getEntitySpriteSheetSource: (kind) => ({ imageUrl: `entity:${kind}` })
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
    source: { imageUrl: 'chamber4:3' },
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
    source: { imageUrl: 'entity:player' },
    x: 114,
    y: 14,
    width: 72,
    height: 72,
    column: 1,
    row: 0,
    entityKind: 'player'
  });
  assert.equal(plan.at(-1).type, 'grid-line-vertical');
});