import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveAnimationFrameName } from '../../renderer/animation-frame.js';

test('returns the default frame when no animation frames are provided', () => {
  assert.equal(resolveAnimationFrameName(null), 'default');
  assert.equal(resolveAnimationFrameName({ frameName: 'idle' }), 'idle');
});

test('advances through named animation frames by elapsed time', () => {
  const frameName = resolveAnimationFrameName({
    frameNames: ['frame-a', 'frame-b', 'frame-c'],
    frameDurationMs: 100,
    loop: true,
    elapsedMs: 250
  });

  assert.equal(frameName, 'frame-c');
});

test('falls back to the first valid frame when metadata is sparse', () => {
  const frameName = resolveAnimationFrameName({
    frameNames: ['frame-a', '', null, 'frame-b'],
    frameDurationMs: 100,
    loop: false,
    elapsedMs: 900
  });

  assert.equal(frameName, 'frame-b');
});