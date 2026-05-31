export function syncCanvasElementSize(canvasEl, rect) {
  if (!canvasEl) {
    return { width: 0, height: 0 };
  }

  const width = Math.max(1, Math.round(Number(rect?.width) || 0));
  const height = Math.max(1, Math.round(Number(rect?.height) || 0));

  if (canvasEl.width !== width) {
    canvasEl.width = width;
  }

  if (canvasEl.height !== height) {
    canvasEl.height = height;
  }

  canvasEl.style.width = `${width}px`;
  canvasEl.style.height = `${height}px`;

  return { width, height };
}