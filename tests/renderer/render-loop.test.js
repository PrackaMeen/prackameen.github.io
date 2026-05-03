import assert from 'node:assert/strict';
import test from 'node:test';

import { createOnDemandRenderLoop } from '../../renderer/render-loop.js';

test('coalesces multiple render requests into a single frame', async () => {
  const calls = [];
  let runFrame = null;
  const loop = createOnDemandRenderLoop({
    requestFrame(callback) {
      calls.push('request');
      runFrame = callback;
      return 1;
    },
    cancelFrame() {
      calls.push('cancel');
    }
  });

  const firstPromise = loop.schedule(async () => {
    calls.push('first');
  });
  const secondPromise = loop.schedule(async () => {
    calls.push('second');
  });

  assert.equal(firstPromise, secondPromise);
  assert.deepEqual(calls, ['request']);

  await runFrame();
  await secondPromise;

  assert.deepEqual(calls, ['request', 'second']);
});

test('cancel rejects the pending frame', async () => {
  const loop = createOnDemandRenderLoop({
    requestFrame(callback) {
      return 1;
    },
    cancelFrame() {
    }
  });

  const pending = loop.schedule(async () => {
    throw new Error('should not run');
  });

  loop.cancel();

  await assert.rejects(pending, /Render was canceled/);
});