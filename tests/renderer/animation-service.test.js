import assert from 'node:assert/strict';
import test from 'node:test';

import { advanceAnimationState, createAnimationState, resetAnimationState } from '../../renderer/animation-service.js';

test('advances looping animation frames and wraps cleanly', () => {
  const state = createAnimationState({ frameCount: 4, frameDurationMs: 100, loop: true });

  const next = advanceAnimationState(state, 250);

  assert.equal(next.frameIndex, 2);
  assert.equal(next.completed, false);
  assert.equal(next.elapsedMs, 250);
});

test('advances non-looping animation frames and marks completion', () => {
  const state = createAnimationState({ frameCount: 3, frameDurationMs: 80, loop: false });

  const next = advanceAnimationState(state, 260);

  assert.equal(next.frameIndex, 2);
  assert.equal(next.completed, true);
  assert.equal(next.elapsedMs, 260);
});

test('resets animation state', () => {
  const state = createAnimationState({ frameCount: 2, frameDurationMs: 90, loop: false });
  const next = resetAnimationState(advanceAnimationState(state, 90));

  assert.equal(next.frameIndex, 0);
  assert.equal(next.completed, false);
  assert.equal(next.elapsedMs, 0);
});