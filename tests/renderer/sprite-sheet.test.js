import assert from 'node:assert/strict';
import test from 'node:test';

import { createSpriteSheetSource, drawSpriteFrame, loadSpriteSheet, normalizeSpriteFrames, resolveSpriteFrame } from '../../renderer/sprite-sheet.js';

test('creates a default sprite-sheet source contract', () => {
  assert.deepEqual(createSpriteSheetSource('./assets/game/tiles/Road0/Road0_0.png'), {
    imageUrl: './assets/game/tiles/Road0/Road0_0.png',
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
      imageUrl: './assets/game/tiles/Road0/Road0_0.png',
      metadataUrl: './assets/game/tiles/Road0/Road0_0.json',
      defaultFrameName: 'frame-0'
    },
    {
      loadImage: async () => ({ width: 512, height: 128 }),
      loadMetadata: async () => ({
        frames: {
          'frame-0': { frame: { x: 0, y: 0, w: 128, h: 128 } },
          'frame-1': { frame: { x: 128, y: 0, w: 128, h: 128 } }
        }
      })
    }
  );

  assert.deepEqual(resolveSpriteFrame(sheet, 'frame-1'), { sx: 128, sy: 0, sw: 128, sh: 128 });
});

test('uses the full fallback image frame when a character sprite fails to load', async () => {
  const sheet = await loadSpriteSheet(
    {
      imageUrl: './assets/game/entities/Char0/Char0_0.png',
      metadataUrl: './assets/game/entities/Char0/Char0_0.json',
      defaultFrameName: 'default'
    },
    {
      loadImage: async (url) => {
        if (url === './assets/game/entities/Char0/Char0_0.png') {
          return null;
        }

        return { width: 128, height: 128 };
      },
      loadMetadata: async () => ({
        frames: {
          default: { frame: { x: 0, y: 0, w: 16, h: 16 } }
        }
      })
    }
  );

  assert.deepEqual(resolveSpriteFrame(sheet, 'default'), { sx: 0, sy: 0, sw: 128, sh: 128 });
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
      imageUrl: './assets/game/tiles/Road0/Road0_0.png',
      metadataUrl: './assets/game/tiles/Road0/Road0_0.json',
      defaultFrameName: 'frame-0'
    },
    'frame-1',
    10,
    20,
    30,
    40,
    {
      loadImage: async () => ({ width: 512, height: 128 }),
      loadMetadata: async () => ({
        frames: {
          'frame-0': { frame: { x: 0, y: 0, w: 128, h: 128 } },
          'frame-1': { frame: { x: 128, y: 0, w: 128, h: 128 } }
        }
      })
    }
  );

  assert.deepEqual(calls, [[{ width: 512, height: 128 }, 128, 0, 128, 128, 10, 20, 30, 40]]);
});