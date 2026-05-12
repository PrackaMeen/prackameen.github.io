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

  const clickPoint = await page.evaluate(({ x, y, fallbackBoardWidth, fallbackBoardHeight }) => {
    const canvasEl = document.getElementById('gameBoardCanvas');
    const mapEl = document.getElementById('gameBoardMap');
    const session = window.__GAME_SESSION__ || {};

    if (!canvasEl || !mapEl) {
      return null;
    }

    const rect = canvasEl.getBoundingClientRect();
    const boardWidth = Number.isInteger(session.boardWidth) && session.boardWidth > 0 ? session.boardWidth : fallbackBoardWidth;
    const boardHeight = Number.isInteger(session.boardHeight) && session.boardHeight > 0 ? session.boardHeight : fallbackBoardHeight;
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

    const clickX = rect.left + panX + ((Number(x) - boardOriginX + 0.5) * cellSize * zoomScale);
    const clickY = rect.top + panY + ((Number(y) - boardOriginY + 0.5) * cellSize * zoomScale);

    return { clickX, clickY };
  }, {
    x,
    y,
    fallbackBoardWidth: boardWidth,
    fallbackBoardHeight: boardHeight
  });

  expect(clickPoint).not.toBeNull();
  await page.mouse.click(clickPoint.clickX, clickPoint.clickY);
}