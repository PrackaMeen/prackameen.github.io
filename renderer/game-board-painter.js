export function paintGameBoardDrawPlan({
  context,
  width,
  height,
  drawPlan,
  drawTileImage,
  drawEntityImage,
  clearCanvas
}) {
  if (!context || !Array.isArray(drawPlan)) {
    return Promise.resolve();
  }

  clearCanvas();
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);

  const drawRequests = [];
  for (const entry of drawPlan) {
    if (entry.type === 'fill-cell') {
      context.fillStyle = entry.fillStyle;
      context.fillRect(entry.x, entry.y, entry.width, entry.height);
      continue;
    }

    if (entry.type === 'tile-sprite') {
      drawRequests.push(drawTileImage(entry.source, entry.x, entry.y, entry.width, entry.height, entry.frameName));
      continue;
    }

    if (entry.type === 'entity-sprite') {
      drawRequests.push(drawEntityImage(entry.source, entry.x, entry.y, entry.width, entry.height, entry.frameName));
    }
  }

  return Promise.all(drawRequests).then(() => {
    context.strokeStyle = 'rgba(16, 42, 60, 0.08)';
    context.lineWidth = 1;

    for (const entry of drawPlan) {
      if (entry.type === 'grid-line-horizontal') {
        context.beginPath();
        context.moveTo(0, entry.y);
        context.lineTo(width, entry.y);
        context.stroke();
        continue;
      }

      if (entry.type === 'grid-line-vertical') {
        context.beginPath();
        context.moveTo(entry.x, 0);
        context.lineTo(entry.x, height);
        context.stroke();
      }
    }
  });
}