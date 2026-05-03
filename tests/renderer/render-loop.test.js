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

test('reschedules a render request that arrives while a frame is running', async () => {
  const calls = [];
  const frameCallbacks = [];
  const loop = createOnDemandRenderLoop({
    requestFrame(callback) {
      calls.push('request');
      frameCallbacks.push(callback);
      return frameCallbacks.length;
    },
    cancelFrame() {
      calls.push('cancel');
    }
  });

  let secondResolved = false;
  const firstPromise = loop.schedule(async () => {
    calls.push('first');
    loop.schedule(async () => {
      calls.push('second');
      secondResolved = true;
    });
  });

  await frameCallbacks[0]();
  await firstPromise;

  assert.deepEqual(calls, ['request', 'first', 'request']);
  assert.equal(secondResolved, false);

  await frameCallbacks[1]();

  assert.equal(secondResolved, true);
  assert.deepEqual(calls, ['request', 'first', 'request', 'second']);
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