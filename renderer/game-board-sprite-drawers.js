export function createGameBoardSpriteDrawers({
  context,
  drawSpriteFrame
}) {
  return {
    drawTileSprite,
    drawEntitySprite,
    getEntityInset
  };

  async function drawTileSprite(sourceUrl, x, y, width, height, frameName = 'default') {
    await drawSpriteFrame(context, sourceUrl, frameName, x, y, width, height);
  }

  async function drawEntitySprite(sourceUrl, x, y, width, height, frameName = 'default') {
    const inset = getEntityInset(width, height);
    await drawSpriteFrame(
      context,
      sourceUrl,
      frameName,
      x + inset,
      y + inset,
      width - inset * 2,
      height - inset * 2
    );
  }

  function getEntityInset(width, height) {
    return Math.max(2, Math.round(Math.min(width, height) * 0.14));
  }
}