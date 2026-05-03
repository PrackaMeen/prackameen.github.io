import assert from 'node:assert/strict';
import test from 'node:test';

import { createGameBoardCanvas } from '../../renderer/game-board-canvas.js';

test('render returns a promise and syncs the canvas to the board size', async () => {
  const calls = [];
  const context = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    clearRect(...args) {
      calls.push(['clearRect', ...args]);
    },
    fillRect(...args) {
      calls.push(['fillRect', ...args]);
    },
    beginPath() {
      calls.push(['beginPath']);
    },
    moveTo(...args) {
      calls.push(['moveTo', ...args]);
    },
    lineTo(...args) {
      calls.push(['lineTo', ...args]);
    },
    stroke() {
      calls.push(['stroke']);
    },
    drawImage() {
      calls.push(['drawImage']);
    }
  };
  const canvasEl = {
    width: 0,
    height: 0,
    style: {},
    getContext(type) {
      return type === '2d' ? context : null;
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

  const renderPromise = renderer.render();

  assert.ok(renderPromise instanceof Promise);

  await renderPromise;

  assert.equal(canvasEl.width, 320);
  assert.equal(canvasEl.height, 240);
  assert.equal(canvasEl.style.width, '320px');
  assert.equal(canvasEl.style.height, '240px');
  assert.deepEqual(calls.slice(0, 2), [
    ['clearRect', 0, 0, 320, 240],
    ['fillRect', 0, 0, 320, 240]
  ]);
});

test('keeps the latest animated session when a newer render arrives before the next animation tick', async () => {
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  const scheduledTasks = [];
  const drawImageCalls = [];

  globalThis.setTimeout = (callback, delay = 0) => {
    const handle = scheduledTasks.length + 1;
    scheduledTasks.push({ handle, delay, callback });
    return handle;
  };
  globalThis.clearTimeout = (handle) => {
    const index = scheduledTasks.findIndex((task) => task.handle === handle);
    if (index >= 0) {
      scheduledTasks.splice(index, 1);
    }
  };

  try {
    const context = {
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 0,
      clearRect() {},
      fillRect() {},
      beginPath() {},
      moveTo() {},
      lineTo() {},
      stroke() {},
      drawImage(...args) {
        drawImageCalls.push(args);
      }
    };
    const canvasEl = {
      width: 0,
      height: 0,
      style: {},
      getContext(type) {
        return type === '2d' ? context : null;
      }
    };
    const mapEl = {
      getBoundingClientRect() {
        return { width: 200, height: 100 };
      }
    };
    const tileSheet = {
      image: {},
      frames: {
        'frame-0': { sx: 0, sy: 0, sw: 16, sh: 16 },
        'frame-1': { sx: 16, sy: 0, sw: 16, sh: 16 },
        'frame-2': { sx: 32, sy: 0, sw: 16, sh: 16 },
        'frame-3': { sx: 48, sy: 0, sw: 16, sh: 16 }
      },
      defaultFrameName: 'frame-0',
      animation: {
        frameNames: ['frame-0', 'frame-1', 'frame-2', 'frame-3'],
        frameDurationMs: 120,
        loop: true,
        elapsedMs: 250
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
      getTileSpriteSheetSource: () => tileSheet,
      getEntitySpriteSheetSource: () => null,
      normalizeTileKind: (value) => value,
      normalizeEntityKind: (value) => value,
      isTileRevealed: () => true
    });

    const firstRender = renderer.render(currentSession);
    const firstFrame = scheduledTasks.find((task) => task.delay === 0);
    await firstFrame.callback();
    await firstRender;

    currentSession = {
      boardWidth: 2,
      boardHeight: 1,
      boardOriginX: 0,
      boardOriginY: 0,
      board: [
        { x: 1, y: 0, tileKind: 'road0', tileOrientation: 0 }
      ]
    };

    const secondRender = renderer.render(currentSession);
    const secondFrame = scheduledTasks.find((task) => task.delay === 0);
    await secondFrame.callback();
    await secondRender;

    const animationTick = scheduledTasks.find((task) => task.delay === 120);
    await animationTick.callback();

    const latestDraw = drawImageCalls.at(-1);
    assert.equal(latestDraw[5], 100);
  } finally {
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  }
});