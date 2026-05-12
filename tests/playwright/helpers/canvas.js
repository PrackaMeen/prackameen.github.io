import { expect } from '@playwright/test';

export async function expectCanvasToMatchHost(canvas, host, tolerancePx = 1) {
  await expect(canvas).toBeVisible();

  const [canvasBox, hostBox] = await Promise.all([
    canvas.boundingBox(),
    host.boundingBox()
  ]);

  expect(canvasBox).not.toBeNull();
  expect(hostBox).not.toBeNull();

  expect(Math.abs(canvasBox.width - hostBox.width)).toBeLessThanOrEqual(tolerancePx);
  expect(Math.abs(canvasBox.height - hostBox.height)).toBeLessThanOrEqual(tolerancePx);
  expect(canvasBox.width).toBeGreaterThan(0);
  expect(canvasBox.height).toBeGreaterThan(0);
}

export async function clickCanvasBoardCell(page, canvas, x, y, boardWidth = 3, boardHeight = 3) {
  await page.waitForFunction(() => {
    const canvasEl = document.getElementById('gameBoardCanvas');
    const mapEl = document.getElementById('gameBoardMap');
    if (!canvasEl || !mapEl) {
      return false;
    }

    const style = window.getComputedStyle(mapEl);
    const rawCellSize = Number.parseFloat(style.getPropertyValue('--game-cell-size') || '');
    const rawZoom = Number.parseFloat(style.getPropertyValue('--game-board-zoom') || '');
    return Number.isFinite(rawCellSize) && rawCellSize > 0 && Number.isFinite(rawZoom) && rawZoom > 0;
  });

  const hasEngine = await page.evaluate(() => Boolean(window.__GAME_BOARD_ENGINE__));
  if (!hasEngine) {
    await page.waitForFunction(() => Boolean(window.__GAME_BOARD_ENGINE__), { timeout: 1000 }).catch(() => undefined);
  }

  const clickPoint = await page.evaluate(async ({ x, y, fallbackBoardWidth, fallbackBoardHeight }) => {
    const canvasEl = document.getElementById('gameBoardCanvas');
    const mapEl = document.getElementById('gameBoardMap');
    const session = window.__GAME_SESSION__ || {};
    const engine = window.__GAME_BOARD_ENGINE__ || null;
    const ex = window.ex || null;

    if (!canvasEl || !mapEl) {
      return null;
    }

    const resolveEnginePoint = () => {
      if (!engine?.screen?.worldToPageCoordinates || typeof ex?.vec !== 'function') {
        return null;
      }

      const boardOriginX = Number.isInteger(session.boardOriginX) ? session.boardOriginX : 0;
      const boardOriginY = Number.isInteger(session.boardOriginY) ? session.boardOriginY : 0;
      const mapStyle = window.getComputedStyle(mapEl);
      const rawCellSize = Number.parseFloat(mapStyle.getPropertyValue('--game-cell-size') || '');
      const rect = canvasEl.getBoundingClientRect();
      const boardWidth = Number.isInteger(session.boardWidth) && session.boardWidth > 0 ? session.boardWidth : fallbackBoardWidth;
      const cellSize = Number.isFinite(rawCellSize) && rawCellSize > 0 ? rawCellSize : rect.width / Math.max(1, boardWidth);
      const worldPoint = ex.vec((Number(x) - boardOriginX + 0.5) * cellSize, (Number(y) - boardOriginY + 0.5) * cellSize);
      const pagePoint = engine.screen.worldToPageCoordinates(worldPoint);
      if (!Number.isFinite(pagePoint?.x) || !Number.isFinite(pagePoint?.y)) {
        return null;
      }

      return { clickX: pagePoint.x, clickY: pagePoint.y };
    };

    for (let attempt = 0; attempt < 6; attempt += 1) {
      const enginePoint = resolveEnginePoint();
      if (enginePoint) {
        return { ...enginePoint, useCanvasClick: false };
      }

      await new Promise((resolve) => requestAnimationFrame(() => resolve()));
    }

    const rect = canvasEl.getBoundingClientRect();
    const boardWidth = Number.isInteger(session.boardWidth) && session.boardWidth > 0 ? session.boardWidth : fallbackBoardWidth;
    const boardOriginX = Number.isInteger(session.boardOriginX) ? session.boardOriginX : 0;
    const boardOriginY = Number.isInteger(session.boardOriginY) ? session.boardOriginY : 0;

    const mapStyle = window.getComputedStyle(mapEl);
    const rawCellSize = Number.parseFloat(mapStyle.getPropertyValue('--game-cell-size') || '');
    const cellSize = Number.isFinite(rawCellSize) && rawCellSize > 0
      ? rawCellSize
      : rect.width / Math.max(1, boardWidth);

    const zoomScale = Number.parseFloat(mapStyle.getPropertyValue('--game-board-zoom') || '1') || 1;
    const panX = Number.parseFloat(mapStyle.getPropertyValue('--game-board-pan-x') || '0') || 0;
    const panY = Number.parseFloat(mapStyle.getPropertyValue('--game-board-pan-y') || '0') || 0;

    return {
      clickX: rect.left + panX + ((Number(x) - boardOriginX + 0.5) * cellSize * zoomScale),
      clickY: rect.top + panY + ((Number(y) - boardOriginY + 0.5) * cellSize * zoomScale),
      useCanvasClick: false
    };
  }, {
    x,
    y,
    fallbackBoardWidth: boardWidth,
    fallbackBoardHeight: boardHeight
  });

  expect(clickPoint).not.toBeNull();
  if (clickPoint.useCanvasClick) {
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).not.toBeNull();

    await canvas.click({
      position: {
        x: clickPoint.clickX - canvasBox.x,
        y: clickPoint.clickY - canvasBox.y
      }
    });
  } else {
    await page.mouse.click(clickPoint.clickX, clickPoint.clickY);
  }

  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
