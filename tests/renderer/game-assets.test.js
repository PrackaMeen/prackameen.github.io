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
      defaultFrameName: 'default'
    });

    assert.deepEqual(getEntitySpriteSheetSource('monster'), {
      imageUrl: 'v:./assets/game/entities/monster.png',
      metadataUrl: 'v:./assets/game/entities/monster.json',
      defaultFrameName: 'default'
    });

    assert.deepEqual(getHiddenTileSpriteSheetSource(), {
      imageUrl: 'v:./assets/game/tiles/Hidden.png',
      metadataUrl: 'v:./assets/game/tiles/Hidden.json',
      defaultFrameName: 'default'
    });

    globalThis.window.__GAME_VERSIONED_ASSET_URL__ = queryVersionedAssetResolver;

    assert.deepEqual(getTileSpriteSheetSource('road1', 2), {
      imageUrl: './assets/game/tiles/Road1_2.png?v=test',
      metadataUrl: './assets/game/tiles/Road1_2.json?v=test',
      defaultFrameName: 'default'
    });
  } finally {
    globalThis.window = originalWindow;
  }
});