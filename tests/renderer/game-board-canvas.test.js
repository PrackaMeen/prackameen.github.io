import assert from 'node:assert/strict';
import test from 'node:test';

import { createGameBoardCanvas } from '../../renderer/game-board-canvas.js';

function installExcaliburStub() {
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  let lastSpriteOptions = null;
  let lastToSpriteOptions = null;

  const stubImageSource = class {
    constructor(url) {
      this.url = url;
    }

    async load() {
      return this;
    }

    toSprite(options = null) {
      lastToSpriteOptions = options;
      return {
        width: Number(options?.sourceView?.width) || 16,
        height: Number(options?.sourceView?.height) || 16,
        sourceView: options?.sourceView ?? null,
        image: this,
        destSize: options?.destSize ?? null
      };
    }
  };

  const stubActor = class {
    constructor() {
      this.graphics = { use() {} };
      this.z = 0;
    }

    kill() {}
  };

  const stubSprite = class {
    constructor(options = {}) {
      lastSpriteOptions = options;
      this.image = options.image;
      this.sourceView = options.sourceView;
      this.width = Number(options?.sourceView?.sw) || 16;
      this.height = Number(options?.sourceView?.sh) || 16;
    }
  };

  const stubScene = class {
    constructor() {
      this.camera = {
        zoom: 1,
        pos: { x: 0, y: 0 }
      };
    }

    add() {}
  };

  const stubEngine = class {
    constructor() {
      this.currentScene = new stubScene();
    }

    add() {}

    goToScene() {}

    async start() {
      return this;
    }

    stop() {}
  };

  globalThis.window = {
    ex: {
      ImageSource: stubImageSource,
      Sprite: stubSprite,
      Actor: stubActor,
      Scene: stubScene,
      Engine: stubEngine,
      DisplayMode: { FillContainer: 'fill' },
      vec: (x, y) => ({ x, y })
    }
  };

  globalThis.document = {
    createElement(tagName) {
      if (tagName !== 'canvas') {
        return null;
      }

      return {
        width: 0,
        height: 0,
        getContext() {
          return {
            clearRect() {},
            drawImage() {}
          };
        },
        toDataURL() {
          return 'data:image/png;base64,stub';
        }
      };
    }
  };

  return {
    getLastSpriteOptions() {
      return lastSpriteOptions;
    },
    getLastToSpriteOptions() {
      return lastToSpriteOptions;
    },
    restore() {
      globalThis.window = originalWindow;
      globalThis.document = originalDocument;
    }
  };
}

test('render returns a promise and syncs the canvas to the board size', async () => {
  const { restore } = installExcaliburStub();
  const canvasEl = {
    width: 0,
    height: 0,
    style: {},
    getContext(type) {
      return type === '2d' ? {} : null;
    }
  };
  const mapEl = {
    getBoundingClientRect() {
      return { width: 320, height: 240 };
    }
  };
  const renderer = createGameBoardCanvas({
    canvasEl,
    mapEl,
    getSession: () => ({
      boardWidth: 1,
      boardHeight: 1,
      board: [{ x: 0, y: 0, tileKind: 'grass' }]
    }),
    getTileSpriteSheetSource: (tileKind) => ({ imageUrl: `tile:${tileKind}` }),
    getEntitySpriteSheetSource: (entityKind) => ({ imageUrl: `entity:${entityKind}` }),
    normalizeTileKind: (tileKind) => tileKind,
    normalizeEntityKind: (entityKind) => entityKind,
    isTileRevealed: () => false
  });

  try {
    const renderPromise = renderer.render();

    assert.ok(renderPromise instanceof Promise);

    await renderPromise;

    assert.equal(canvasEl.width, 320);
    assert.equal(canvasEl.height, 240);
    assert.equal(canvasEl.style.width, '100%');
    assert.equal(canvasEl.style.height, '100%');
  } finally {
    restore();
  }
});

test('renders successive animated sessions through the Excalibur path', async () => {
  const { restore } = installExcaliburStub();
  try {
    const canvasEl = {
      width: 0,
      height: 0,
      style: {},
      getContext(type) {
        return type === '2d' ? { clearRect() {} } : null;
      }
    };
    const mapEl = {
      getBoundingClientRect() {
        return { width: 200, height: 100 };
      }
    };
    let currentSession = {
      boardWidth: 2,
      boardHeight: 1,
      boardOriginX: 0,
      boardOriginY: 0,
      board: [
        { x: 0, y: 0, tileKind: 'road0', tileOrientation: 0 }
      ]
    };

    const renderer = createGameBoardCanvas({
      canvasEl,
      mapEl,
      getSession: () => currentSession,
      getTileSpriteSheetSource: (tileKind) => ({ imageUrl: `tile:${tileKind}`, metadataUrl: 'tile:meta', defaultFrameName: 'frame-0', animation: null }),
      getEntitySpriteSheetSource: () => null,
      normalizeTileKind: (value) => value,
      normalizeEntityKind: (value) => value,
      isTileRevealed: () => true
    });

    await renderer.render(currentSession);

    currentSession = {
      boardWidth: 2,
      boardHeight: 1,
      boardOriginX: 0,
      boardOriginY: 0,
      board: [
        { x: 1, y: 0, tileKind: 'road0', tileOrientation: 0 }
      ]
    };

    await renderer.render(currentSession);

    assert.equal(canvasEl.width, 200);
    assert.equal(canvasEl.height, 100);
  } finally {
    restore();
  }
});

test('syncCamera applies viewport transform immediately when engine is ready', async () => {
  const { restore } = installExcaliburStub();
  try {
    const canvasEl = {
      width: 0,
      height: 0,
      style: {},
      getContext(type) {
        return type === '2d' ? { clearRect() {} } : null;
      }
    };
    const mapEl = {
      getBoundingClientRect() {
        return { width: 300, height: 200 };
      }
    };

    const renderer = createGameBoardCanvas({
      canvasEl,
      mapEl,
      getSession: () => ({
        boardWidth: 3,
        boardHeight: 2,
        boardOriginX: 0,
        boardOriginY: 0,
        board: [{ x: 0, y: 0, tileKind: 'road0', tileOrientation: 0 }]
      }),
      getTileSpriteSheetSource: (tileKind) => ({ imageUrl: `tile:${tileKind}` }),
      getEntitySpriteSheetSource: () => null,
      normalizeTileKind: (value) => value,
      normalizeEntityKind: (value) => value,
      isTileRevealed: () => true
    });

    await renderer.render();

    renderer.syncCamera({ scale: 2, panX: 40, panY: 20 }, 300, 200);

    const camera = renderer.getEngine().currentScene.camera;
    assert.equal(camera.zoom, 2);
    assert.deepEqual(camera.pos, { x: 55, y: 40 });
  } finally {
    restore();
  }
});

test('continues rendering while animated sources are present', async () => {
  const { restore } = installExcaliburStub();
  const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
  const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;

  globalThis.requestAnimationFrame = (callback) => setTimeout(() => callback(16), 0);
  globalThis.cancelAnimationFrame = (handle) => clearTimeout(handle);

  try {
    const canvasEl = {
      width: 0,
      height: 0,
      style: {},
      getContext(type) {
        return type === '2d' ? { clearRect() {} } : null;
      }
    };
    const mapEl = {
      getBoundingClientRect() {
        return { width: 160, height: 160 };
      }
    };

    const renderer = createGameBoardCanvas({
      canvasEl,
      mapEl,
      getSession: () => ({
        boardWidth: 1,
        boardHeight: 1,
        board: [{ x: 0, y: 0, tileKind: 'road0', tileOrientation: 0 }]
      }),
      getTileSpriteSheetSource: () => ({
        imageUrl: 'tile:road0',
        metadataUrl: 'tile:road0:meta',
        defaultFrameName: 'frame-0',
        animation: {
          frameNames: ['frame-0', 'frame-1'],
          frameDurationMs: 120,
          loop: true
        }
      }),
      getEntitySpriteSheetSource: () => null,
      normalizeTileKind: (value) => value,
      normalizeEntityKind: (value) => value,
      isTileRevealed: () => true
    });

    await renderer.render();
    await new Promise((resolve) => setTimeout(resolve, 40));

    const renderCount = Number(globalThis.window?.__GAME_BOARD_RENDER_COUNT__ || 0);
    assert.equal(renderCount > 1, true);

    renderer.dispose();
  } finally {
    globalThis.requestAnimationFrame = originalRequestAnimationFrame;
    globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
    restore();
  }
});

test('builds sheet-backed sprites with an Excalibur ImageSource', async () => {
  const { restore, getLastToSpriteOptions } = installExcaliburStub();
  const originalImage = globalThis.Image;
  const originalFetch = globalThis.fetch;

  globalThis.Image = class {
    constructor() {
      this.width = 64;
      this.height = 64;
    }

    set src(value) {
      this._src = value;
      queueMicrotask(() => this.onload?.());
    }
  };

  globalThis.fetch = async () => ({
    ok: true,
    async json() {
      return {
        frames: {
          'frame-0': { frame: { x: 8, y: 12, w: 16, h: 20 } }
        }
      };
    }
  });

  try {
    const canvasEl = {
      width: 0,
      height: 0,
      style: {},
      getContext(type) {
        return type === '2d' ? {} : null;
      }
    };
    const mapEl = {
      getBoundingClientRect() {
        return { width: 160, height: 160 };
      }
    };

    const renderer = createGameBoardCanvas({
      canvasEl,
      mapEl,
      getSession: () => ({
        boardWidth: 1,
        boardHeight: 1,
        board: [{ x: 0, y: 0, tileKind: 'road0', tileOrientation: 0 }]
      }),
      getTileSpriteSheetSource: () => ({
        imageUrl: './assets/game/tiles/Road0/Road0_0.png',
        metadataUrl: './assets/game/tiles/Road0/Road0_0.json',
        defaultFrameName: 'frame-0',
        animation: null
      }),
      getEntitySpriteSheetSource: () => null,
      normalizeTileKind: (value) => value,
      normalizeEntityKind: (value) => value,
      isTileRevealed: () => true
    });

    await renderer.render();

    const spriteOptions = getLastToSpriteOptions();
    assert.deepEqual(spriteOptions, {
      sourceView: { x: 8, y: 12, width: 16, height: 20 }
    });
  } finally {
    globalThis.Image = originalImage;
    globalThis.fetch = originalFetch;
    restore();
  }
});