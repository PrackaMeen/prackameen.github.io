import assert from 'node:assert/strict';
import test from 'node:test';

import { applyTileDefinitionsFromRuntime, getTileWalls, normalizeTileKind } from '../../lib/game-assets.js';
import { classifyTargetPreview } from '../../renderer/board-selection.js';
import { canTraverseBetweenCells } from '../../renderer/board-movement.js';
import { createGameBoardOverlayCanvas } from '../../renderer/game-board-overlay-canvas.js';

const TILE_KINDS = ['road0', 'road1', 'road2', 'road3', 'road4', 'chamber0', 'chamber1', 'chamber2', 'chamber3', 'chamber4'];

applyTileDefinitionsFromRuntime(buildAllTileDefinitions());

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

  console.log('discovered tile sprite validation', {
    tileKind: 'road2',
    tileOrientation: 2,
    spriteSheetSource: drawCalls[0].spriteSheetSource
  });

  assert.equal(drawCalls.length, 1);
  assert.deepEqual(drawCalls[0].spriteSheetSource, {
    imageUrl: 'tile:road2:2',
    defaultFrameName: 'frame-0',
    animation: null
  });

  overlay.dispose();
});

test('overlay preview colors every tile kind and orientation according to the wall layout', async () => {
  const context = createMockContext();
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
    getSession: () => null,
    getCellSize: () => 100,
    getOverlayState: () => overlayState,
    getHiddenTileAssetUrl: () => null,
    isTileRevealed: () => false
  });

  for (const tileKind of TILE_KINDS) {
    for (let orientation = 0; orientation < 4; orientation += 1) {
      const session = createSession(tileKind, orientation);

      for (const target of getTargetsForTile(tileKind, orientation)) {
        const previewTone = classifyTargetPreview({
          currentSession: session,
          source: { x: 1, y: 1 },
          target,
          isTileRevealed: () => false,
          getBoardCell: (currentSession, x, y) => currentSession.board.find((cell) => cell.x === x && cell.y === y) || null,
          canTraverseBetweenCells: (fromCell, toCell) => canTraverseBetweenCells(fromCell, toCell, {
            normalizeTileKind,
            getTileWalls
          }),
          isTargetEngaged: () => false
        });

        overlayState = {
          selectedSource: { x: 1, y: 1, colorHex: '#14532d' },
          pendingTarget: target,
          selectionPreviewTone: previewTone,
          boardOriginX: 0,
          boardOriginY: 0,
          viewportScale: 1,
          viewportPanX: 0,
          viewportPanY: 0
        };

        context._strokeStyle = null;

        await overlay.render(session);

        console.log('discovery validation', {
          tileKind,
          tileOrientation: orientation,
          target,
          tone: previewTone.tone,
          color: previewTone.color
        });

        assert.equal(previewTone.tone, isOpenTowards(tileKind, orientation, target) ? 'green' : 'red');
        assert.equal(context.strokeStyle, previewTone.color);
      }
    }
  }

  overlay.dispose();
});

function buildAllTileDefinitions() {
  const tileKinds = {};

  for (const tileKind of TILE_KINDS) {
    const folderName = toFolderName(tileKind);
    tileKinds[tileKind] = [0, 1, 2, 3].map((orientation) => ({
      orientation,
      sprite: `./assets/game/tiles/${folderName}/${folderName}_${orientation}.png`,
      walls: createWalls(tileKind, orientation)
    }));
  }

  return { tileKinds };
}

function createSession(tileKind, orientation) {
  return {
    boardWidth: 3,
    boardHeight: 3,
    boardOriginX: 0,
    boardOriginY: 0,
    board: [
      { x: 1, y: 1, tileKind, tileOrientation: orientation },
      { x: 1, y: 0, tileKind: 'road4', tileOrientation: 0 },
      { x: 2, y: 1, tileKind: 'road4', tileOrientation: 0 },
      { x: 1, y: 2, tileKind: 'road4', tileOrientation: 0 },
      { x: 0, y: 1, tileKind: 'road4', tileOrientation: 0 }
    ]
  };
}

function getTargetsForTile(tileKind, orientation) {
  const targets = [];

  if (isOpenTowards(tileKind, orientation, { x: 1, y: 0 })) {
    targets.push({ x: 1, y: 0 });
  }
  if (isOpenTowards(tileKind, orientation, { x: 2, y: 1 })) {
    targets.push({ x: 2, y: 1 });
  }
  if (isOpenTowards(tileKind, orientation, { x: 1, y: 2 })) {
    targets.push({ x: 1, y: 2 });
  }
  if (isOpenTowards(tileKind, orientation, { x: 0, y: 1 })) {
    targets.push({ x: 0, y: 1 });
  }

  return targets;
}

function createWalls(tileKind, orientation) {
  const open = getOpenDirections(tileKind, orientation);

  return {
    north: !open.north,
    east: !open.east,
    south: !open.south,
    west: !open.west
  };
}

function getOpenDirections(tileKind, orientation) {
  const family = tileKind.replace(/[0-9]+$/, '');

  switch (family) {
    case 'road0':
    case 'chamber0':
      return [
        { north: false, east: true, south: true, west: true },
        { north: true, east: false, south: true, west: true },
        { north: true, east: true, south: false, west: true },
        { north: true, east: true, south: true, west: false }
      ][orientation];
    case 'road1':
    case 'chamber1':
      return orientation % 2 === 0
        ? { north: true, east: false, south: true, west: false }
        : { north: false, east: true, south: false, west: true };
    case 'road2':
    case 'chamber2':
      return [
        { north: false, east: false, south: true, west: true },
        { north: true, east: false, south: false, west: true },
        { north: true, east: true, south: false, west: false },
        { north: false, east: true, south: true, west: false }
      ][orientation];
    case 'road3':
    case 'chamber3':
      return [
        { north: false, east: true, south: true, west: true },
        { north: true, east: false, south: true, west: true },
        { north: true, east: true, south: false, west: true },
        { north: true, east: true, south: true, west: false }
      ][orientation];
    case 'road4':
    case 'chamber4':
      return { north: true, east: true, south: true, west: true };
    default:
      return { north: true, east: true, south: true, west: true };
  }
}

function isOpenTowards(tileKind, orientation, target) {
  const open = getOpenDirections(tileKind, orientation);

  if (target.x === 1 && target.y === 0) {
    return open.north;
  }

  if (target.x === 2 && target.y === 1) {
    return open.east;
  }

  if (target.x === 1 && target.y === 2) {
    return open.south;
  }

  return open.west;
}

function toFolderName(tileKind) {
  return `${tileKind[0].toUpperCase()}${tileKind.slice(1)}`;
}

function createMockContext() {
  return {
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
}