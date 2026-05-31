export function createAnimationState({ frameCount, frameDurationMs, loop = true }) {
  return {
    frameCount: Math.max(0, Math.floor(frameCount || 0)),
    frameDurationMs: Math.max(1, Math.floor(frameDurationMs || 1)),
    loop: Boolean(loop),
    elapsedMs: 0,
    frameIndex: 0,
    completed: false
  };
}

export function advanceAnimationState(state, deltaMs) {
  const frameCount = Math.max(0, Math.floor(state?.frameCount || 0));
  const frameDurationMs = Math.max(1, Math.floor(state?.frameDurationMs || 1));
  const loop = Boolean(state?.loop);
  const elapsedMs = Math.max(0, Math.floor(state?.elapsedMs || 0) + Math.max(0, Math.floor(deltaMs || 0)));
  const totalDurationMs = frameCount * frameDurationMs;

  if (frameCount <= 0 || totalDurationMs <= 0) {
    return {
      ...state,
      elapsedMs,
      frameIndex: 0,
      completed: true
    };
  }

  const adjustedElapsedMs = loop ? elapsedMs % totalDurationMs : Math.min(elapsedMs, totalDurationMs);
  const frameIndex = Math.min(frameCount - 1, Math.floor(adjustedElapsedMs / frameDurationMs));

  return {
    ...state,
    elapsedMs,
    frameIndex,
    completed: !loop && elapsedMs >= totalDurationMs
  };
}

export function resetAnimationState(state) {
  return {
    ...state,
    elapsedMs: 0,
    frameIndex: 0,
    completed: false
  };
}