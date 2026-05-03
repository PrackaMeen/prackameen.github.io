import { drawSpriteFrame } from './sprite-sheet.js';
import { buildGameBoardDrawPlan } from './game-board-draw-plan.js';
import { paintGameBoardDrawPlan } from './game-board-painter.js';
import { syncCanvasElementSize } from './canvas-size.js';
import { createGameBoardSpriteDrawers } from './game-board-sprite-drawers.js';
import { createOnDemandRenderLoop } from './render-loop.js';

export function createGameBoardCanvas({
  canvasEl,
  mapEl,
  getSession,
  getTileSpriteSheetSource,
  getEntitySpriteSheetSource,
  normalizeTileKind,
  normalizeEntityKind,
  isTileRevealed
}) {
  const context = canvasEl?.getContext?.("2d") ?? null;
  const spriteDrawers = createGameBoardSpriteDrawers({
    context,
    drawSpriteFrame
  });
  const renderLoop = createOnDemandRenderLoop();
  const resizeObserver = typeof ResizeObserver !== "undefined" && mapEl
    ? new ResizeObserver(() => {
        render(getSession());
      })
    : null;
  let renderToken = 0;
  let animationTimerId = null;
  let animationSession = null;

  if (resizeObserver && mapEl) {
    resizeObserver.observe(mapEl);
  }

  return {
    render,
    dispose
  };

  function dispose() {
    resizeObserver?.disconnect();
    renderLoop.cancel();
    stopAnimationLoop();
  }

  function render(session = getSession()) {
    if (!canvasEl || !context || !mapEl) {
      return Promise.resolve();
    }

    const token = renderToken + 1;
    renderToken = token;
    return renderLoop.schedule(() => drawSession(session, token));
  }

  async function drawSession(session, token) {
    const boardWidth = Number.isInteger(session?.boardWidth) && session.boardWidth > 0 ? session.boardWidth : 0;
    const boardHeight = Number.isInteger(session?.boardHeight) && session.boardHeight > 0 ? session.boardHeight : 0;

    if (boardWidth <= 0 || boardHeight <= 0) {
      clearCanvas();
      return;
    }

    const canvasSize = syncCanvasElementSize(canvasEl, mapEl.getBoundingClientRect());
    const width = canvasSize.width;
    const height = canvasSize.height;

    if (token !== renderToken) {
      return;
    }

    const drawPlan = buildGameBoardDrawPlan({
      session,
      boardWidth,
      boardHeight,
      canvasWidth: width,
      canvasHeight: height,
      currentTimeMs: Date.now(),
      isTileRevealed,
      normalizeTileKind,
      normalizeEntityKind,
      getTileSpriteSheetSource,
      getEntitySpriteSheetSource
    });

    await paintGameBoardDrawPlan({
      context,
      width,
      height,
      drawPlan,
      drawTileImage: spriteDrawers.drawTileSprite,
      drawEntityImage: spriteDrawers.drawEntitySprite,
      clearCanvas
    });

    if (token !== renderToken) {
      return;
    }

    if (drawPlan.some((entry) => entry.animated)) {
      startAnimationLoop(session);
    } else {
      stopAnimationLoop();
    }
  }

  function clearCanvas() {
    if (!canvasEl || !context) {
      return;
    }

    context.clearRect(0, 0, canvasEl.width, canvasEl.height);
  }

  function startAnimationLoop(session) {
    animationSession = session;

    if (animationTimerId !== null) {
      return;
    }

    const tick = () => {
      animationTimerId = setTimeout(() => {
        animationTimerId = null;
        if (!animationSession) {
          return;
        }

        render(animationSession);
        tick();
      }, 120);
    };

    tick();
  }

  function stopAnimationLoop() {
    animationSession = null;

    if (animationTimerId !== null) {
      clearTimeout(animationTimerId);
      animationTimerId = null;
    }
  }

}