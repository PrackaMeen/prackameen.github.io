import { chromium } from 'playwright';
import { createGameBoardSession, installGameBoardStub } from './helpers/game-board.js';
import { clickCanvasBoardCell } from './helpers/canvas.js';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 412, height: 915 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();

  const session = createGameBoardSession({
    width: 6,
    height: 4,
    source: { x: 1, y: 1 },
    tileKind: 'road4',
    revealedTiles: Array.from({ length: 4 }, (_, y) => Array.from({ length: 6 }, (_, x) => ({ x, y }))).flat()
  });

  await installGameBoardStub(page, session);
  
  await page.goto('http://127.0.0.1:5500/#/game-board');

  const canvas = await page.waitForSelector('#gameBoardCanvas');

  const firstPoint = await page.evaluate(() => {
    const canvasEl = document.getElementById('gameBoardCanvas');
    const mapEl = document.getElementById('gameBoardMap');
    const session = window.__GAME_SESSION__ || {};
    const engine = window.__GAME_BOARD_ENGINE__ || null;
    const ex = window.ex || null;
    const rect = canvasEl.getBoundingClientRect();
    const mapStyle = window.getComputedStyle(mapEl);
    const rawCellSize = Number.parseFloat(mapStyle.getPropertyValue('--game-cell-size') || '');
    const cellSize = Number.isFinite(rawCellSize) && rawCellSize > 0 ? rawCellSize : rect.width / Math.max(1, session.boardWidth || 1);
    const worldPoint = ex?.vec ? ex.vec((1 + 0.5) * cellSize, (1 + 0.5) * cellSize) : null;
    const pagePoint = worldPoint && engine?.screen?.worldToPageCoordinates ? engine.screen.worldToPageCoordinates(worldPoint) : null;
    return { rect, cellSize, pagePoint };
  });
  console.log('firstPoint', JSON.stringify(firstPoint));

  await clickCanvasBoardCell(page, canvas, 1, 1, 6, 4);
  const secondPoint = await page.evaluate(() => {
    const canvasEl = document.getElementById('gameBoardCanvas');
    const mapEl = document.getElementById('gameBoardMap');
    const session = window.__GAME_SESSION__ || {};
    const engine = window.__GAME_BOARD_ENGINE__ || null;
    const ex = window.ex || null;
    const rect = canvasEl.getBoundingClientRect();
    const mapStyle = window.getComputedStyle(mapEl);
    const rawCellSize = Number.parseFloat(mapStyle.getPropertyValue('--game-cell-size') || '');
    const cellSize = Number.isFinite(rawCellSize) && rawCellSize > 0 ? rawCellSize : rect.width / Math.max(1, session.boardWidth || 1);
    const worldPoint = ex?.vec ? ex.vec((2 + 0.5) * cellSize, (1 + 0.5) * cellSize) : null;
    const pagePoint = worldPoint && engine?.screen?.worldToPageCoordinates ? engine.screen.worldToPageCoordinates(worldPoint) : null;
    return { rect, cellSize, pagePoint };
  });
  console.log('secondPoint', JSON.stringify(secondPoint));
  await clickCanvasBoardCell(page, canvas, 2, 1, 6, 4);

  const state = await page.evaluate(() => window.__GAME_BOARD_STATE__);
  console.log('__GAME_BOARD_STATE__:');
  console.log(JSON.stringify(state, null, 2));

  const buttons = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('.game-board-action-bar button'));
    return btns.map(b => ({
      label: b.textContent.trim(),
      disabled: b.disabled,
      visible: b.offsetWidth > 0 && b.offsetHeight > 0
    })).filter(b => b.visible);
  });
  console.log('Visible Action Bar Buttons:');
  console.log(JSON.stringify(buttons, null, 2));

  await browser.close();
})();