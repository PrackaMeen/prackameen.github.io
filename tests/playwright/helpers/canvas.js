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
  const box = await canvas.boundingBox();

  expect(box).not.toBeNull();

  const cellWidth = box.width / boardWidth;
  const cellHeight = box.height / boardHeight;

  await page.mouse.click(
    box.x + (cellWidth * x) + (cellWidth / 2),
    box.y + (cellHeight * y) + (cellHeight / 2)
  );
}