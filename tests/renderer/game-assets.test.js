import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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
      imageUrl: 'v:./assets/game/tiles/Road1/Road1_2.png',
      metadataUrl: 'v:./assets/game/tiles/Road1/Road1_2.json',
      defaultFrameName: 'frame-0',
      animation: null
    });

    assert.deepEqual(getEntitySpriteSheetSource('monster'), {
      imageUrl: 'v:./assets/game/entities/monster.png',
      metadataUrl: 'v:./assets/game/entities/monster.json',
      defaultFrameName: 'default',
      animation: null
    });

    assert.deepEqual(getEntitySpriteSheetSource('player', { selected: true, orientation: 2 }), {
      imageUrl: 'v:./assets/game/entities/Char0/Char0_2.png',
      metadataUrl: 'v:./assets/game/entities/Char0/Char0_2.json',
      defaultFrameName: 'default',
      animation: null
    });

    assert.deepEqual(getEntitySpriteSheetSource('player', { selected: false, orientation: 3 }), {
      imageUrl: 'v:./assets/game/entities/Char1/Char1_3.png',
      metadataUrl: 'v:./assets/game/entities/Char1/Char1_3.json',
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
      imageUrl: './assets/game/tiles/Road1/Road1_2.png?v=test',
      metadataUrl: './assets/game/tiles/Road1/Road1_2.json?v=test',
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

test('keeps the client fallback tile definitions in sync with tile-definitions.json', async () => {
  const originalWindow = globalThis.window;
  globalThis.window = { __GAME_VERSIONED_ASSET_URL__: versionedAssetResolver };

  try {
    const {
      getTileSpriteSheetSource,
      getTileWalls
    } = await import(new URL('../../lib/game-assets.js?sync-check=' + Date.now(), import.meta.url));

    const jsonText = await readFile(new URL('../../assets/game/tile-definitions.json', import.meta.url), 'utf8');
    const parsedDefinitions = JSON.parse(jsonText);
    const tileKinds = parsedDefinitions.tileKinds || {};

    for (const [tileKind, variants] of Object.entries(tileKinds)) {
      assert.equal(Array.isArray(variants), true, `Expected ${tileKind} to have an orientation list`);

      for (const variant of variants) {
        const orientation = Number.isInteger(variant.orientation) ? variant.orientation : 0;
        const expectedAnimation = variant.animation
          ? {
              frameNames: variant.animation.frameNames,
              frameDurationMs: variant.animation.frameDurationMs,
              loop: variant.animation.loop,
              defaultFrameName: variant.animation.defaultFrameName || variant.animation.frameNames?.[0] || 'frame-0'
            }
          : null;

        assert.deepEqual(getTileSpriteSheetSource(tileKind, orientation), {
          imageUrl: `v:${variant.sprite}`,
          metadataUrl: `v:${variant.sprite.replace(/\.png$/i, '.json')}`,
          defaultFrameName: expectedAnimation?.defaultFrameName || 'frame-0',
          animation: expectedAnimation
        });

        assert.deepEqual(getTileWalls(tileKind, orientation), variant.walls);
      }
    }
  } finally {
    globalThis.window = originalWindow;
  }
});