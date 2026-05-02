import assert from 'node:assert/strict';
import test from 'node:test';

import { paintGameBoardDrawPlan } from '../../renderer/game-board-painter.js';

test('paints fills before sprites and grid lines after sprite draws finish', async () => {
  const calls = [];
  const context = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
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
    }
  };
  const drawPlan = [
    { type: 'fill-cell', x: 0, y: 0, width: 10, height: 10, fillStyle: '#fefefe' },
    { type: 'tile-sprite', source: 'tile.png', x: 10, y: 0, width: 10, height: 10, frameName: 'default' },
    { type: 'entity-sprite', source: 'entity.png', x: 12, y: 2, width: 6, height: 6, frameName: 'default' },
    { type: 'grid-line-horizontal', y: 0.5 },
    { type: 'grid-line-vertical', x: 10.5 }
  ];
  const drawTileCalls = [];
  const drawEntityCalls = [];

  await paintGameBoardDrawPlan({
    context,
    width: 20,
    height: 10,
    drawPlan,
    drawTileImage: async (...args) => {
      drawTileCalls.push(args);
    },
    drawEntityImage: async (...args) => {
      drawEntityCalls.push(args);
    },
    clearCanvas: () => {
      calls.push(['clearCanvas']);
    }
  });

  assert.deepEqual(calls.slice(0, 2), [
    ['clearCanvas'],
    ['fillRect', 0, 0, 20, 10]
  ]);
  assert.deepEqual(drawTileCalls, [['tile.png', 10, 0, 10, 10, 'default']]);
  assert.deepEqual(drawEntityCalls, [['entity.png', 12, 2, 6, 6, 'default']]);
  assert.deepEqual(calls.at(-4), ['beginPath']);
  assert.deepEqual(calls.at(-1), ['stroke']);
});