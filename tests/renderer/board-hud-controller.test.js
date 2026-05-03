import assert from 'node:assert/strict';
import test from 'node:test';

import { createBoardHudController } from '../../renderer/board-hud-controller.js';

function createButtonElement() {
  return {
    type: '',
    className: '',
    disabled: false,
    textContent: '',
    listeners: {},
    addEventListener(type, handler) {
      this.listeners[type] = handler;
    },
    click() {
      this.listeners.click?.();
    },
    setAttribute() {},
    style: {}
  };
}

test('shows a recenter button when the camera is off-center', () => {
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  const buttons = [];
  const actionBarEl = {
    replaceChildren(...nodes) {
      buttons.splice(0, buttons.length, ...nodes);
    }
  };

  globalThis.document = {
    createElement(tagName) {
      if (tagName === 'button' || tagName === 'div') {
        return createButtonElement();
      }

      return createButtonElement();
    }
  };
  globalThis.window = originalWindow ?? {};

  try {
    const state = {
      feedback: '',
      selectedSource: null,
      pendingTarget: null,
      pendingPlacement: null,
      selectionPreviewTone: null,
      isSubmitting: false,
      activePlayerName: 'Player A',
      session: { pendingPlacement: null }
    };

    let centered = false;
    let recentered = false;
    const hud = createBoardHudController({
      state,
      actionBarEl,
      setNavMessage() {},
      isTileRevealed() {
        return false;
      },
      getTileAssetUrl() {
        return './tile.png';
      },
      isCameraCentered() {
        return centered;
      },
      onCenterCamera() {
        recentered = true;
      },
      onPerformAction() {},
      onCancelSelection() {},
      onRotatePlacement() {}
    });

    hud.syncHud();

    assert.equal(buttons.some((node) => node.textContent === 'Center View'), true);
    buttons.find((node) => node.textContent === 'Center View').click();
    assert.equal(recentered, true);

    centered = true;
    hud.syncHud();
    assert.equal(buttons.some((node) => node.textContent === 'Center View'), false);
  } finally {
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
  }
});

test('renders the placement preview from the tile sprite sheet frame', async () => {
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  const originalDateNow = Date.now;
  Date.now = () => 250;
  const previewDraws = [];
  const actionBarEl = {
    replaceChildren(...nodes) {
      this.nodes = nodes;
    }
  };

  function createElement(tagName) {
    if (tagName === 'button' || tagName === 'div') {
      return {
        type: '',
        className: '',
        disabled: false,
        textContent: '',
        listeners: {},
        style: {},
        children: [],
        addEventListener(type, handler) {
          this.listeners[type] = handler;
        },
        click() {
          this.listeners.click?.();
        },
        setAttribute() {},
        appendChild(child) {
          this.children.push(child);
        },
        replaceChildren(...nodes) {
          this.children = nodes;
        }
      };
    }

    if (tagName === 'canvas') {
      return {
        width: 0,
        height: 0,
        style: {},
        setAttribute() {},
        getContext() {
          return {
            drawImage() {
              previewDraws.push(arguments);
            }
          };
        }
      };
    }

    return {
      style: {},
      setAttribute() {},
      appendChild() {},
      replaceChildren() {}
    };
  }

  globalThis.document = { createElement };
  globalThis.window = originalWindow ?? {};

  try {
    const state = {
      feedback: '',
      selectedSource: null,
      pendingTarget: null,
      pendingPlacement: {
        tileKind: 'road0',
        tileOrientation: 0,
        canCommit: true
      },
      selectionPreviewTone: null,
      isSubmitting: false,
      activePlayerName: 'Player A',
      session: { pendingPlacement: null }
    };

    const hud = createBoardHudController({
      state,
      actionBarEl,
      setNavMessage() {},
      isTileRevealed() {
        return false;
      },
      getTileAssetUrl() {
        return './tile.png';
      },
      getTileSpriteSheetSource() {
        return {
          imageUrl: './assets/game/tiles/Road0/Road0_0.png',
          animation: {
            frameNames: ['frame-0', 'frame-1', 'frame-2', 'frame-3'],
            elapsedMs: 0,
            frameDurationMs: 120,
            loop: true
          }
        };
      },
      drawTileSpriteFrame: async (_context, _source, frameName) => {
        previewDraws.push(frameName);
      },
      isCameraCentered() {
        return true;
      },
      onCenterCamera() {},
      onPerformAction() {},
      onCancelSelection() {},
      onRotatePlacement() {}
    });

    hud.syncHud();
    await Promise.resolve();
    await Promise.resolve();

    assert.deepEqual(previewDraws, ['frame-2']);
  } finally {
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
    Date.now = originalDateNow;
  }
});