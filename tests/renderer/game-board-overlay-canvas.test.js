import assert from 'node:assert/strict';
import test from 'node:test';

import { applyTileDefinitionsFromRuntime, getTileWalls, normalizeTileKind } from '../../lib/game-assets.js';
import { classifyTargetPreview } from '../../renderer/board-selection.js';
import { canTraverseBetweenCells } from '../../renderer/board-movement.js';
import { createGameBoardOverlayCanvas } from '../../renderer/game-board-overlay-canvas.js';

applyTileDefinitionsFromRuntime({
  tileKinds: {
    road2: [
      { orientation: 0, sprite: './assets/game/tiles/Road2/Road2_0.png', walls: { north: true, east: true, south: false, west: false } },
      { orientation: 1, sprite: './assets/game/tiles/Road2/Road2_1.png', walls: { north: false, east: true, south: true, west: false } },
      { orientation: 2, sprite: './assets/game/tiles/Road2/Road2_2.png', walls: { north: false, east: false, south: true, west: true } },
      { orientation: 3, sprite: './assets/game/tiles/Road2/Road2_3.png', walls: { north: true, east: false, south: false, west: true } }
    ],
    road4: [
      { orientation: 0, sprite: './assets/game/tiles/Road4/Road4_0.png', walls: { north: false, east: false, south: false, west: false } },
      { orientation: 1, sprite: './assets/game/tiles/Road4/Road4_1.png', walls: { north: false, east: false, south: false, west: false } },
      { orientation: 2, sprite: './assets/game/tiles/Road4/Road4_2.png', walls: { north: false, east: false, south: false, west: false } },
      { orientation: 3, sprite: './assets/game/tiles/Road4/Road4_3.png', walls: { north: false, east: false, south: false, west: false } }
    ]
  }
});

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

test('overlay preview colors a road2_1 corner according to the wall layout', async () => {
  const session = {
    boardWidth: 3,
    boardHeight: 3,
    boardOriginX: 0,
    boardOriginY: 0,
    board: [
      { x: 1, y: 1, tileKind: 'road2', tileOrientation: 1 },
      { x: 1, y: 0, tileKind: 'road4', tileOrientation: 0 },
      { x: 2, y: 1, tileKind: 'road4', tileOrientation: 0 },
      { x: 1, y: 2, tileKind: 'road4', tileOrientation: 0 },
      { x: 0, y: 1, tileKind: 'road4', tileOrientation: 0 }
    ]
  };

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
    get strokeStyle() {
      return this._strokeStyle;
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

  let overlayState = null;
  const overlay = createGameBoardOverlayCanvas({
    canvasEl: {
      width: 300,
      height: 300,
      style: {},
      getContext: () => context
    },
    mapEl: {
      getBoundingClientRect: () => ({ width: 300, height: 300 })
    },
    getSession: () => session,
    getCellSize: () => 100,
    getOverlayState: () => overlayState,
    getHiddenTileAssetUrl: () => null,
    isTileRevealed: (_currentSession, x, y) => (x === 1 && y === 1) || (x === overlayState?.pendingTarget?.x && y === overlayState?.pendingTarget?.y)
  });

  const cases = [
    { target: { x: 1, y: 0 }, expectedTone: 'green', expectedColor: '#14532d' },
    { target: { x: 2, y: 1 }, expectedTone: 'red', expectedColor: '#b91c1c' },
    { target: { x: 1, y: 2 }, expectedTone: 'red', expectedColor: '#b91c1c' },
    { target: { x: 0, y: 1 }, expectedTone: 'green', expectedColor: '#14532d' }
  ];

  for (const testCase of cases) {
    const previewTone = classifyTargetPreview({
      currentSession: session,
      source: { x: 1, y: 1 },
      target: testCase.target,
      isTileRevealed: (_currentSession, x, y) => x === testCase.target.x && y === testCase.target.y,
      getBoardCell: (currentSession, x, y) => currentSession.board.find((cell) => cell.x === x && cell.y === y) || null,
      canTraverseBetweenCells: (fromCell, toCell) => canTraverseBetweenCells(fromCell, toCell, {
        normalizeTileKind,
        getTileWalls
      }),
      isTargetEngaged: () => false
    });

    overlayState = {
      selectedSource: { x: 1, y: 1, colorHex: '#14532d' },
      pendingTarget: testCase.target,
      selectionPreviewTone: previewTone,
      boardOriginX: 0,
      boardOriginY: 0,
      viewportScale: 1,
      viewportPanX: 0,
      viewportPanY: 0
    };

    context._strokeStyle = null;
    context._fillStyle = null;

    await overlay.render(session);

    assert.equal(previewTone.tone, testCase.expectedTone);
    assert.equal(context.strokeStyle, testCase.expectedColor);
  }

  overlay.dispose();
});