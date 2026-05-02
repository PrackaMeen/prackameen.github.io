import assert from 'node:assert/strict';
import test from 'node:test';

import { createGameBoardSpriteDrawers } from '../../renderer/game-board-sprite-drawers.js';

test('calculates the entity inset from the rendered bounds', () => {
  const spriteDrawers = createGameBoardSpriteDrawers({
    context: null,
    drawSpriteFrame: async () => undefined,
    createSpriteSheetSource: (sourceUrl) => sourceUrl
  });

  assert.equal(spriteDrawers.getEntityInset(80, 60), 8);
  assert.equal(spriteDrawers.getEntityInset(10, 10), 2);
});

test('wires tile and entity sprite draws through the shared frame drawer', async () => {
  const calls = [];
  const spriteDrawers = createGameBoardSpriteDrawers({
    context: { id: 'context' },
    drawSpriteFrame: async (...args) => {
      calls.push(args);
    },
    createSpriteSheetSource: (sourceUrl) => ({ sourceUrl })
  });

  await spriteDrawers.drawTileSprite('./assets/game/tiles/Road0_0.png', 10, 20, 30, 40, 'idle');
  await spriteDrawers.drawEntitySprite('./assets/game/entities/player.png', 10, 20, 30, 40, 'idle');

  assert.deepEqual(calls[0], [{ id: 'context' }, { sourceUrl: './assets/game/tiles/Road0_0.png' }, 'idle', 10, 20, 30, 40]);
  assert.deepEqual(calls[1], [{ id: 'context' }, { sourceUrl: './assets/game/entities/player.png' }, 'idle', 14, 24, 22, 32]);
});