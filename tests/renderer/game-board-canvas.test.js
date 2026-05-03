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
  const boardEl = {
    getBoundingClientRect() {
      return { width: 320, height: 240 };
    }
  };
  const renderer = createGameBoardCanvas({
    canvasEl,
    boardEl,
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