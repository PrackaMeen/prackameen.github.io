import { advanceAnimationState, createAnimationState } from './animation-service.js';

export function resolveAnimationFrameName(animation, elapsedMs = 0) {
  const frameNames = Array.isArray(animation?.frameNames)
    ? animation.frameNames.filter((frameName) => typeof frameName === 'string' && frameName.length > 0)
    : [];

  if (!frameNames.length) {
    return animation?.frameName || 'default';
  }

  const state = createAnimationState({
    frameCount: frameNames.length,
    frameDurationMs: animation?.frameDurationMs ?? 100,
    loop: animation?.loop ?? true
  });

  const nextState = advanceAnimationState(
    {
      ...state,
      elapsedMs: Number.isFinite(Number(animation?.elapsedMs)) ? Number(animation.elapsedMs) : Number.isFinite(Number(elapsedMs)) ? Number(elapsedMs) : 0
    },
    Number.isFinite(Number(elapsedMs)) ? Number(elapsedMs) : 0
  );

  return frameNames[nextState.frameIndex] ?? frameNames[0] ?? animation?.frameName ?? 'default';
}