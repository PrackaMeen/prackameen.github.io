import assert from 'node:assert/strict';
import test from 'node:test';

import { createGameBoardCanvas } from '../../renderer/game-board-canvas.js';

function installExcaliburStub() {
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;

  const stubImageSource = class {
    constructor(url) {
      this.url = url;
    }

    async load() {
      return this;
    }

    toSprite() {
      return { width: 16, height: 16 };
    }
  };

  const stubActor = class {
    constructor() {
      this.graphics = { use() {} };
      this.z = 0;
    }

    kill() {}
  };

  const stubScene = class {
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

  return () => {
    globalThis.window = originalWindow;
    globalThis.document = originalDocument;
  };
}

test('render returns a promise and syncs the canvas to the board size', async () => {
  const restore = installExcaliburStub();
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
    assert.equal(canvasEl.style.width, '320px');
    assert.equal(canvasEl.style.height, '240px');
  } finally {
    restore();
  }
});

test('renders successive animated sessions through the Excalibur path', async () => {
  const restore = installExcaliburStub();
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