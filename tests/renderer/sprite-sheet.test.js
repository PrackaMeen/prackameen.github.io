import assert from 'node:assert/strict';
import test from 'node:test';

import { createSpriteSheetSource, drawSpriteFrame, loadSpriteSheet, normalizeSpriteFrames, resolveSpriteFrame } from '../../renderer/sprite-sheet.js';

test('creates a default sprite-sheet source contract', () => {
  assert.deepEqual(createSpriteSheetSource('./assets/game/tiles/Road0_0.png'), {
    imageUrl: './assets/game/tiles/Road0_0.png',
    metadataUrl: null,
    defaultFrameName: 'default'
  });
});

test('normalizes texture frame metadata', () => {
  assert.deepEqual(
    normalizeSpriteFrames({ idle: { frame: { x: 4, y: 8, w: 16, h: 32 } } }),
    { idle: { sx: 4, sy: 8, sw: 16, sh: 32 } }
  );
});

test('falls back to the default frame when a named frame is missing', () => {
  const sheet = {
    image: { width: 64, height: 64 },
    defaultFrameName: 'default',
    frames: {
      default: { sx: 0, sy: 0, sw: 64, sh: 64 }
    }
  };

  assert.deepEqual(resolveSpriteFrame(sheet, 'missing'), { sx: 0, sy: 0, sw: 64, sh: 64 });
});

test('loads and resolves atlas metadata through injected loaders', async () => {
  const sheet = await loadSpriteSheet(
    {
      imageUrl: './assets/game/tiles/Road0.png',
      metadataUrl: './assets/game/tiles/Road0.json',
      defaultFrameName: 'idle'
    },
    {
      loadImage: async () => ({ width: 128, height: 128 }),
      loadMetadata: async () => ({
        frames: {
          idle: { frame: { x: 8, y: 12, w: 24, h: 30 } }
        }
      })
    }
  );

  assert.deepEqual(resolveSpriteFrame(sheet, 'idle'), { sx: 8, sy: 12, sw: 24, sh: 30 });
});

test('draws a resolved sprite frame onto the provided context', async () => {
  const calls = [];
  const context = {
    drawImage(...args) {
      calls.push(args);
    }
  };

  await drawSpriteFrame(
    context,
    {
      imageUrl: './assets/game/tiles/Road0.png',
      metadataUrl: './assets/game/tiles/Road0.json',
      defaultFrameName: 'idle'
    },
    'idle',
    10,
    20,
    30,
    40,
    {
      loadImage: async () => ({ width: 128, height: 128 }),
      loadMetadata: async () => ({
        frames: {
          idle: { frame: { x: 8, y: 12, w: 24, h: 30 } }
        }
      })
    }
  );

  assert.deepEqual(calls, [[{ width: 128, height: 128 }, 8, 12, 24, 30, 10, 20, 30, 40]]);
});