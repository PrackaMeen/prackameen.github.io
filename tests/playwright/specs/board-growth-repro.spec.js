import { expect, test } from '@playwright/test';
import { createGameBoardSession, installGameBoardStub } from '../helpers/game-board.js';
import { clickCanvasBoardCell } from '../helpers/canvas.js';

test.describe('Board growth repro', () => {
  test('shows extra rendered tiles after the right, up, down, right move sequence', async ({ page }) => {
    const revealedTiles = [];
    for (let y = 0; y < 4; y += 1) {
      for (let x = 0; x < 4; x += 1) {
        revealedTiles.push({ x, y });
      }
    }

    await installGameBoardStub(page, createGameBoardSession({
      width: 4,
      height: 4,
      source: { x: 1, y: 1 },
      tileKind: 'road4',
      revealedTiles
    }));

    await page.goto('/#/game-board');
    await expect(page.locator('.game-board-cell')).toHaveCount(16);

    await page.evaluate(() => {
      let moveCount = 0;
      const originalApplyAction = window.GameWasm.applyAction.bind(window.GameWasm);

      window.GameWasm.applyAction = async (request) => {
        const response = await originalApplyAction(request);

        if (String(request?.actionName || '').toLowerCase() !== 'move' || !response?.snapshot) {
          return response;
        }

        moveCount += 1;
        if (moveCount !== 4) {
          return response;
        }

        const snapshot = JSON.parse(JSON.stringify(response.snapshot));
        snapshot.boardWidth = 5;
        snapshot.boardHeight = 5;

        snapshot.board.push(
          { x: 4, y: 1, tileKind: 'direct-road', tileOrientation: 0 },
          { x: 4, y: 2, tileKind: 'direct-road', tileOrientation: 0 },
          { x: 2, y: 4, tileKind: 'direct-road', tileOrientation: 0 }
        );

        window.__GAME_SESSION__ = snapshot;
        return { ...response, snapshot };
      };
    });

    const canvas = page.locator('#gameBoardCanvas');

    await movePlayer(page, canvas, { x: 1, y: 1 }, { x: 2, y: 1 });
    await movePlayer(page, canvas, { x: 2, y: 1 }, { x: 2, y: 0 });
    await movePlayer(page, canvas, { x: 2, y: 0 }, { x: 2, y: 1 });
    await movePlayer(page, canvas, { x: 2, y: 1 }, { x: 3, y: 1 });

    await expect(page.locator('.game-board-cell[data-x="4"][data-y="1"]')).toBeVisible();
    await expect(page.locator('.game-board-cell[data-x="2"][data-y="4"]')).toBeVisible();

    const cellCount = await page.locator('.game-board-cell').count();
    expect(cellCount).toBeGreaterThan(16);
  });

  test('shows extra rendered tiles after appending, committing, moving right, and appending again', async ({ page }) => {
    const hiddenTargets = new Set(['3,1', '5,1']);
    const revealedTiles = [];
    for (let y = 0; y < 4; y += 1) {
      for (let x = 0; x < 6; x += 1) {
        if (!hiddenTargets.has(`${x},${y}`)) {
          revealedTiles.push({ x, y });
        }
      }
    }

    await installGameBoardStub(page, createGameBoardSession({
      width: 6,
      height: 4,
      source: { x: 1, y: 1 },
      tileKind: 'road4',
      revealedTiles
    }));

    await page.goto('/#/game-board');
    await expect(page.locator('.game-board-cell')).toHaveCount(24);

    await page.waitForFunction(() => Boolean(window.GameWasm?.applyAction));

    const canvas = page.locator('#gameBoardCanvas');

    await page.evaluate(() => {
      let discoverCount = 0;
      const originalApplyAction = window.GameWasm.applyAction.bind(window.GameWasm);

      window.GameWasm.applyAction = async (request) => {
        const response = await originalApplyAction(request);
        const actionName = String(request?.actionName || '').toLowerCase();

        if (!response?.snapshot) {
          return response;
        }

        if (actionName === 'discover') {
          discoverCount += 1;
          if (discoverCount !== 2) {
            return response;
          }

          const snapshot = JSON.parse(JSON.stringify(response.snapshot));
          snapshot.boardWidth = 7;
          snapshot.boardHeight = 5;
          snapshot.board.push(
            { x: 6, y: 1, tileKind: 'road4', tileOrientation: 0 },
            { x: 6, y: 2, tileKind: 'road4', tileOrientation: 0 }
          );

          window.__GAME_SESSION__ = snapshot;
          return { ...response, snapshot };
        }

        return response;
      };
    });

    await clickCanvasBoardCell(page, canvas, 1, 1, 6, 4);
    await clickCanvasBoardCell(page, canvas, 2, 1, 6, 4);
    await expect(page.getByRole('button', { name: 'Confirm Move' })).toBeVisible();
    await page.getByRole('button', { name: 'Confirm Move' }).click();

    await expect(page.locator('.game-board-cell--active-player[data-x="2"][data-y="1"]')).toHaveCount(1);

    await clickCanvasBoardCell(page, canvas, 2, 1, 6, 4);
    await clickCanvasBoardCell(page, canvas, 3, 1, 6, 4);
    await expect(page.getByRole('button', { name: 'Place Tile' })).toBeVisible();
    await page.getByRole('button', { name: 'Place Tile' }).click();
    await page.getByRole('button', { name: 'Place & Move' }).click();

    await clickCanvasBoardCell(page, canvas, 3, 1, 6, 4);
    await clickCanvasBoardCell(page, canvas, 4, 1, 6, 4);
    await expect(page.getByRole('button', { name: 'Confirm Move' })).toBeVisible();
    await page.getByRole('button', { name: 'Confirm Move' }).click();

    await clickCanvasBoardCell(page, canvas, 4, 1, 6, 4);
    await clickCanvasBoardCell(page, canvas, 5, 1, 6, 4);
    await expect(page.getByRole('button', { name: 'Place Tile' })).toBeVisible();
    await page.getByRole('button', { name: 'Place Tile' }).click();

    await expect(page.locator('.game-board-cell[data-x="6"][data-y="1"]')).toBeVisible();
    await expect(page.locator('.game-board-cell[data-x="6"][data-y="2"]')).toBeVisible();

    const cellCount = await page.locator('.game-board-cell').count();
    expect(cellCount).toBeGreaterThan(24);
  });

  test('captures the horizontal road4 discover preview before commit', async ({ page }, testInfo) => {
    await installGameBoardStub(page, createGameBoardSession({
      width: 3,
      height: 3,
      source: { x: 1, y: 1 },
      tileKind: 'road4',
      revealedTiles: [
        { x: 0, y: 1 },
        { x: 1, y: 1 }
      ]
    }));

    await page.goto('/#/game-board');
    await page.waitForFunction(() => Boolean(window.GameWasm?.applyAction));
    await page.addStyleTag({
      content: `
        .game-board {
          --game-cell-base-size: 7.5rem !important;
        }
      `
    });

    const canvas = page.locator('#gameBoardCanvas');

    await clickCanvasBoardCell(page, canvas, 1, 1, 3, 3);
    await clickCanvasBoardCell(page, canvas, 2, 1, 3, 3);

    await expect(page.locator('.game-board-cell--temporary-preview[data-x="2"][data-y="1"]')).toHaveCount(1);
    await expect(page.getByText('Hidden tile preview.')).toBeVisible();

    const screenshotPath = testInfo.outputPath('three-tile-row-preview.png');
    const clip = await page.evaluate(() => {
      const cells = Array.from(document.querySelectorAll('.game-board-cell[data-y="1"]'));
      const boxes = cells.map((cell) => cell.getBoundingClientRect());
      const left = Math.min(...boxes.map((box) => box.left)) - 40;
      const top = Math.min(...boxes.map((box) => box.top)) - 40;
      const right = Math.max(...boxes.map((box) => box.right)) + 40;
      const bottom = Math.max(...boxes.map((box) => box.bottom)) + 40;

      return { x: Math.max(0, left), y: Math.max(0, top), width: right - left, height: bottom - top };
    });

    await page.screenshot({ path: screenshotPath, clip });
    await testInfo.attach('three-tile-row-preview', {
      path: screenshotPath,
      contentType: 'image/png'
    });
  });
});

async function movePlayer(page, canvas, source, target) {
  await clickCanvasBoardCell(page, canvas, source.x, source.y, 4, 4);
  await clickCanvasBoardCell(page, canvas, target.x, target.y, 4, 4);
  await expect(page.getByRole('button', { name: 'Confirm Move' })).toBeVisible();
  await page.getByRole('button', { name: 'Confirm Move' }).click();
}