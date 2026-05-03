import assert from 'node:assert/strict';
import test from 'node:test';

import { createGameBoardOverlayCanvas } from '../../renderer/game-board-overlay-canvas.js';

test('overlay preview uses the locked cell size instead of stretching to the canvas aspect ratio', async () => {
  const calls = [];
  const context = {
    save() {},
    restore() {},
    clearRect() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
    closePath() {},
    fill() {},
    fillRect(x, y, width, height) {
      calls.push({ type: 'fillRect', x, y, width, height });
    },
    strokeRect(x, y, width, height) {
      calls.push({ type: 'strokeRect', x, y, width, height });
    },
    drawImage() {},
    set lineWidth(value) {
      this._lineWidth = value;
    },
    get lineWidth() {
      return this._lineWidth || 0;
    },
    set strokeStyle(value) {
      this._strokeStyle = value;
    },
    set fillStyle(value) {
      this._fillStyle = value;
    },
    set globalAlpha(value) {
      this._globalAlpha = value;
    },
    set lineCap(value) {
      this._lineCap = value;
    },
    setLineDash() {}
  };

  const overlay = createGameBoardOverlayCanvas({
    canvasEl: {
      width: 300,
      height: 400,
      style: {},
      getContext: () => context
    },
    mapEl: {
      getBoundingClientRect: () => ({ width: 300, height: 400 })
    },
    getSession: () => ({
      boardWidth: 5,
      boardHeight: 3,
      boardOriginX: 0,
      boardOriginY: 0,
      board: []
    }),
    getCellSize: () => 60,
    getOverlayState: () => ({
      selectedSource: { x: 1, y: 1, colorHex: '#14532d' },
      pendingTarget: { x: 1, y: 2 },
      selectionPreviewTone: { tone: 'green', color: '#14532d' },
      boardOriginX: 0,
      boardOriginY: 0,
      viewportScale: 1,
      viewportPanX: 0,
      viewportPanY: 0
    }),
    getHiddenTileAssetUrl: () => null,
    isTileRevealed: () => false
  });

  await overlay.render();

  const previewFill = calls.find((call) => call.type === 'fillRect' && call.width > 0 && call.height > 0);
  assert.deepEqual({ width: previewFill.width, height: previewFill.height }, { width: 60, height: 60 });

  overlay.dispose();
});

test('overlay preview resolves the discovered tile sprite from the pending placement', async () => {
  const drawCalls = [];
  const context = {
    save() {},
    restore() {},
    clearRect() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
    closePath() {},
    fill() {},
    fillRect() {},
    strokeRect() {},
    drawImage() {},
    set lineWidth(value) {
      this._lineWidth = value;
    },
    get lineWidth() {
      return this._lineWidth || 0;
    },
    set strokeStyle(value) {
      this._strokeStyle = value;
    },
    set fillStyle(value) {
      this._fillStyle = value;
    },
    set globalAlpha(value) {
      this._globalAlpha = value;
    },
    set lineCap(value) {
      this._lineCap = value;
    },
    setLineDash() {}
  };

  const overlay = createGameBoardOverlayCanvas({
    canvasEl: {
      width: 300,
      height: 400,
      style: {},
      getContext: () => context
    },
    mapEl: {
      getBoundingClientRect: () => ({ width: 300, height: 400 })
    },
    getSession: () => ({
      boardWidth: 5,
      boardHeight: 3,
      boardOriginX: 0,
      boardOriginY: 0,
      board: []
    }),
    getCellSize: () => 60,
    getOverlayState: () => ({
      selectedSource: { x: 1, y: 1, colorHex: '#14532d' },
      pendingTarget: { x: 1, y: 2 },
      pendingPlacement: {
        tileKind: 'road2',
        tileOrientation: 2
      },
      selectionPreviewTone: { tone: 'green', color: '#14532d' },
      boardOriginX: 0,
      boardOriginY: 0,
      viewportScale: 1,
      viewportPanX: 0,
      viewportPanY: 0
    }),
    getHiddenTileAssetUrl: () => null,
    getTileSpriteSheetSource: (tileKind, tileOrientation) => ({
      imageUrl: `tile:${tileKind}:${tileOrientation}`,
      defaultFrameName: 'frame-0',
      animation: null
    }),
    drawTileSpriteFrame: async (_context, spriteSheetSource, frameName, x, y, width, height) => {
      drawCalls.push({ spriteSheetSource, frameName, x, y, width, height });
    },
    isTileRevealed: () => false
  });

  await overlay.render();

  assert.equal(drawCalls.length, 1);
  assert.deepEqual(drawCalls[0].spriteSheetSource, {
    imageUrl: 'tile:road2:2',
    defaultFrameName: 'frame-0',
    animation: null
  });

  overlay.dispose();
});