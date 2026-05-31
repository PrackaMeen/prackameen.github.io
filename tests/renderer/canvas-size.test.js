import assert from 'node:assert/strict';
import test from 'node:test';

import { syncCanvasElementSize } from '../../renderer/canvas-size.js';

test('syncs canvas size from the layout rect', () => {
  const canvasEl = {
    width: 0,
    height: 0,
    style: {}
  };

  assert.deepEqual(syncCanvasElementSize(canvasEl, { width: 319.4, height: 215.6 }), { width: 319, height: 216 });
  assert.equal(canvasEl.width, 319);
  assert.equal(canvasEl.height, 216);
  assert.equal(canvasEl.style.width, '319px');
  assert.equal(canvasEl.style.height, '216px');
});

test('keeps minimum canvas dimensions at one pixel', () => {
  const canvasEl = {
    width: 10,
    height: 10,
    style: {}
  };

  assert.deepEqual(syncCanvasElementSize(canvasEl, { width: 0, height: -14 }), { width: 1, height: 1 });
  assert.equal(canvasEl.width, 1);
  assert.equal(canvasEl.height, 1);
});