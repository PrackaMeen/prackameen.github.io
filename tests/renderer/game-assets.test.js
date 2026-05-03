import assert from 'node:assert/strict';
import test from 'node:test';

const versionedAssetResolver = (assetPath) => `v:${assetPath}`;
const queryVersionedAssetResolver = (assetPath) => `${assetPath}?v=test`;

test('builds sprite-sheet sources for tiles, entities, and hidden tiles', async () => {
  const originalWindow = globalThis.window;
  globalThis.window = { __GAME_VERSIONED_ASSET_URL__: versionedAssetResolver };

  try {
    const {
      getEntitySpriteSheetSource,
      getHiddenTileSpriteSheetSource,
      getTileSpriteSheetSource
    } = await import('../../lib/game-assets.js');

    assert.deepEqual(getTileSpriteSheetSource('road1', 2), {
      imageUrl: 'v:./assets/game/tiles/Road1_2.png',
      metadataUrl: 'v:./assets/game/tiles/Road1_2.json',
      defaultFrameName: 'frame-0',
      animation: null
    });

    assert.deepEqual(getEntitySpriteSheetSource('monster'), {
      imageUrl: 'v:./assets/game/entities/monster.png',
      metadataUrl: 'v:./assets/game/entities/monster.json',
      defaultFrameName: 'default',
      animation: null
    });

    assert.deepEqual(getHiddenTileSpriteSheetSource(), {
      imageUrl: 'v:./assets/game/tiles/Hidden.png',
      metadataUrl: 'v:./assets/game/tiles/Hidden.json',
      defaultFrameName: 'default',
      animation: null
    });

    globalThis.window.__GAME_VERSIONED_ASSET_URL__ = queryVersionedAssetResolver;

    assert.deepEqual(getTileSpriteSheetSource('road1', 2), {
      imageUrl: './assets/game/tiles/Road1_2.png?v=test',
      metadataUrl: './assets/game/tiles/Road1_2.json?v=test',
      defaultFrameName: 'frame-0',
      animation: null
    });
  } finally {
    globalThis.window = originalWindow;
  }
});

test('keeps Road0 animation when runtime tile definitions are applied', async () => {
  const originalWindow = globalThis.window;
  globalThis.window = { __GAME_VERSIONED_ASSET_URL__: versionedAssetResolver };

  try {
    const {
      applyTileDefinitionsFromRuntime,
      getTileSpriteSheetSource
    } = await import('../../lib/game-assets.js');

    applyTileDefinitionsFromRuntime({
      tileKinds: {
        road0: [
          { orientation: 0, sprite: './assets/game/tiles/Road0_0.png' },
          { orientation: 1, sprite: './assets/game/tiles/Road0_1.png' },
          { orientation: 2, sprite: './assets/game/tiles/Road0_2.png' },
          { orientation: 3, sprite: './assets/game/tiles/Road0_3.png' }
        ]
      }
    });

    assert.deepEqual(getTileSpriteSheetSource('road0', 0), {
      imageUrl: 'v:./assets/game/tiles/Road0_0.png',
      metadataUrl: 'v:./assets/game/tiles/Road0_0.json',
      defaultFrameName: 'frame-0',
      animation: {
        frameNames: ['frame-0', 'frame-1', 'frame-2', 'frame-3'],
        frameDurationMs: 120,
        loop: true,
        defaultFrameName: 'frame-0'
      }
    });
  } finally {
    globalThis.window = originalWindow;
  }
});