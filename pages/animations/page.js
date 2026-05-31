import { drawSpriteFrame } from "../../renderer/sprite-sheet.js";
import { resolveAnimationFrameName } from "../../renderer/animation-frame.js";

export async function mountPage(context) {
  context.setTitle("Animations");

  const { loadAnimatedSpriteSources } = await import(`../../lib/game-assets.js?v=${encodeURIComponent(context.appBuildId || context.appVersion || "latest")}`);

  const stageEl = document.getElementById("animationStage");
  const canvasEl = document.getElementById("animationCanvas");
  const selectEl = document.getElementById("animationSelect");
  const detailsEl = document.getElementById("animationDetails");

  let sources = [];
  let selectedSource = null;
  let animationStartMs = performance.now();
  let animationFrameHandle = null;
  let isDisposed = false;

  await initialize();

  return {
    dispose() {
      isDisposed = true;
      if (animationFrameHandle !== null) {
        cancelAnimationFrame(animationFrameHandle);
        animationFrameHandle = null;
      }
    }
  };

  async function initialize() {
    sources = await loadAnimatedSpriteSources();

    if (!selectEl || !detailsEl || !canvasEl || !stageEl) {
      return;
    }

    if (!sources.length) {
      selectEl.replaceChildren(new Option("No animated sources found", ""));
      selectEl.disabled = true;
      detailsEl.textContent = "No animated tile sheets are available in the current asset set.";
      renderOnce();
      return;
    }

    selectEl.disabled = false;
    selectEl.replaceChildren(...sources.map((source) => new Option(source.label, source.id)));
    selectEl.value = sources[0].id;
    selectedSource = sources[0];
    animationStartMs = performance.now();

    selectEl.addEventListener("change", handleSelectionChange);
    window.addEventListener("resize", renderOnce);

    updateDetails();
    void startRenderLoop();
  }

  function handleSelectionChange() {
    selectedSource = sources.find((source) => source.id === selectEl.value) || sources[0] || null;
    animationStartMs = performance.now();
    updateDetails();
    renderOnce();
  }

  function updateDetails() {
    if (!selectedSource) {
      detailsEl.textContent = "";
      return;
    }

    detailsEl.textContent = `${selectedSource.label} • ${selectedSource.animation.frameNames.length} frames • ${selectedSource.animation.frameDurationMs}ms per frame`;
  }

  async function startRenderLoop() {
    if (isDisposed) {
      return;
    }

    await renderOnce();

    if (isDisposed) {
      return;
    }

    animationFrameHandle = requestAnimationFrame(() => {
      animationFrameHandle = null;
      void startRenderLoop();
    });
  }

  async function renderOnce() {
    if (!canvasEl || !stageEl || !selectedSource) {
      return;
    }

    const rect = stageEl.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    const pixelRatio = Math.max(1, window.devicePixelRatio || 1);
    const targetWidth = Math.max(1, Math.floor(width * pixelRatio));
    const targetHeight = Math.max(1, Math.floor(height * pixelRatio));

    if (canvasEl.width !== targetWidth || canvasEl.height !== targetHeight) {
      canvasEl.width = targetWidth;
      canvasEl.height = targetHeight;
    }

    canvasEl.style.width = `${width}px`;
    canvasEl.style.height = `${height}px`;

    const context = canvasEl.getContext("2d");
    if (!context) {
      return;
    }

    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvasEl.width, canvasEl.height);
    context.fillStyle = "#111827";
    context.fillRect(0, 0, canvasEl.width, canvasEl.height);
    context.restore();

    const animation = selectedSource.animation;
    const frameName = resolveAnimationFrameName(animation, performance.now() - animationStartMs);
    const drawSize = Math.floor(Math.min(canvasEl.width, canvasEl.height) * 0.76);
    const drawX = Math.floor((canvasEl.width - drawSize) / 2);
    const drawY = Math.floor((canvasEl.height - drawSize) / 2);

    context.save();
    context.fillStyle = "rgba(255, 255, 255, 0.04)";
    for (let y = 0; y < canvasEl.height; y += Math.max(32, Math.floor(canvasEl.height / 10))) {
      context.fillRect(0, y, canvasEl.width, 1);
    }
    for (let x = 0; x < canvasEl.width; x += Math.max(32, Math.floor(canvasEl.width / 10))) {
      context.fillRect(x, 0, 1, canvasEl.height);
    }
    context.restore();

    await drawSpriteFrame(context, selectedSource.source, frameName, drawX, drawY, drawSize, drawSize);

    context.save();
    context.strokeStyle = "rgba(255, 255, 255, 0.16)";
    context.lineWidth = Math.max(2, Math.round(canvasEl.width / 256));
    context.strokeRect(drawX, drawY, drawSize, drawSize);
    context.restore();
  }
}