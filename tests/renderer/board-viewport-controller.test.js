import assert from 'node:assert/strict';
import test from 'node:test';

import { createBoardViewportController } from '../../renderer/board-viewport-controller.js';

function createController(stateOverrides = {}) {
  const state = {
    zoomScale: 1,
    panX: 0,
    panY: 0,
    activeTouchPoints: new Map(),
    boardWidth: 4,
    boardHeight: 4,
    boardOriginX: 0,
    boardOriginY: 0,
    ...stateOverrides
  };

  const mapEl = {
    style: {
      setProperty() {},
      getPropertyValue() { return ''; }
    },
    getBoundingClientRect() {
      return { width: 200, height: 200 };
    }
  };

  const stageEl = {
    clientWidth: 200,
    clientHeight: 200
  };

  const canvasEl = {
    contains() {
      return true;
    }
  };

  return {
    state,
    controller: createBoardViewportController({
      state,
      mapEl,
      stageEl,
      canvasEl,
      onZoomChanged() {},
      onViewportChanged() {},
      onBoardStateChanged() {}
    })
  };
}

test('returns a tap for a quick one-finger press', () => {
  const originalNow = Date.now;
  let now = 1000;
  Date.now = () => now;

  try {
    const { controller, state } = createController();
    const touch = { identifier: 1, clientX: 48, clientY: 52 };

    controller.handleMapTouchStart({ target: {}, changedTouches: [touch] });
    now += 140;
    const result = controller.handleMapTouchEnd({ changedTouches: [touch] });

    assert.deepEqual(result, { kind: 'tap', point: { clientX: 48, clientY: 52 } });
    assert.equal(state.activeTouchPoints.size, 0);
  } finally {
    Date.now = originalNow;
  }
});

test('pans the map after a long press and drag', () => {
  const originalNow = Date.now;
  let now = 2000;
  Date.now = () => now;

  try {
    const { controller, state } = createController();
    const touch = { identifier: 1, clientX: 60, clientY: 60 };

    controller.handleMapTouchStart({ target: {}, changedTouches: [touch] });
    now += 380;
    controller.handleMapTouchMove({ target: {}, changedTouches: [{ identifier: 1, clientX: 88, clientY: 74 }], cancelable: true, preventDefault() {} });

    assert.equal(state.panX, 28);
    assert.equal(state.panY, 14);

    const result = controller.handleMapTouchEnd({ changedTouches: [{ identifier: 1, clientX: 88, clientY: 74 }] });
    assert.equal(result, null);
  } finally {
    Date.now = originalNow;
  }
});

test('zooms with a two-finger pinch gesture', () => {
  const originalNow = Date.now;
  let now = 3000;
  Date.now = () => now;

  try {
    const { controller, state } = createController();

    controller.handleMapTouchStart({ target: {}, changedTouches: [{ identifier: 1, clientX: 50, clientY: 50 }] });
    controller.handleMapTouchStart({ target: {}, changedTouches: [{ identifier: 2, clientX: 150, clientY: 50 }] });
    now += 16;
    controller.handleMapTouchMove({ target: {}, changedTouches: [{ identifier: 2, clientX: 180, clientY: 50 }], cancelable: true, preventDefault() {} });

    assert.ok(state.zoomScale > 1);
    assert.equal(state.panX, 15);
    assert.equal(state.panY, 0);
  } finally {
    Date.now = originalNow;
  }
});