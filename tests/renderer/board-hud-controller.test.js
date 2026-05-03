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