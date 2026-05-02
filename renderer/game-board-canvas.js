const imageCache = new Map();

export function createGameBoardCanvas({
  canvasEl,
  boardEl,
  getSession,
  getTileAssetUrl,
  getEntityAssetUrl,
  normalizeTileKind,
  normalizeEntityKind,
  isTileRevealed
}) {
  const context = canvasEl?.getContext?.("2d") ?? null;
  const resizeObserver = typeof ResizeObserver !== "undefined" && boardEl
    ? new ResizeObserver(() => {
        render(getSession());
      })
    : null;
  let renderToken = 0;

  if (resizeObserver && boardEl) {
    resizeObserver.observe(boardEl);
  }

  return {
    render,
    dispose
  };

  function dispose() {
    resizeObserver?.disconnect();
  }

  function render(session = getSession()) {
    if (!canvasEl || !context || !boardEl) {
      return;
    }

    const token = renderToken + 1;
    renderToken = token;
    void drawSession(session, token);
  }

  async function drawSession(session, token) {
    const boardWidth = Number.isInteger(session?.boardWidth) && session.boardWidth > 0 ? session.boardWidth : 0;
    const boardHeight = Number.isInteger(session?.boardHeight) && session.boardHeight > 0 ? session.boardHeight : 0;

    if (boardWidth <= 0 || boardHeight <= 0) {
      clearCanvas();
      return;
    }

    const rect = boardEl.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));

    if (canvasEl.width !== width) {
      canvasEl.width = width;
    }

    if (canvasEl.height !== height) {
      canvasEl.height = height;
    }

    canvasEl.style.width = `${width}px`;
    canvasEl.style.height = `${height}px`;

    const cells = Array.isArray(session?.board) ? session.board : [];
    const cellWidth = width / boardWidth;
    const cellHeight = height / boardHeight;
    const drawRequests = [];

    clearCanvas();
    context.fillStyle = "rgba(10, 28, 42, 0.12)";
    context.fillRect(0, 0, width, height);

    for (const cell of cells) {
      const x = Number.isInteger(cell?.x) ? cell.x : 0;
      const y = Number.isInteger(cell?.y) ? cell.y : 0;
      const tileKind = normalizeTileKind(cell?.tileKind || cell?.kind || cell?.terrainKind);
      const tileOrientation = Number.isInteger(cell?.tileOrientation)
        ? cell.tileOrientation
        : Number.isInteger(cell?.orientation)
          ? cell.orientation
          : 0;
      const isRevealed = isTileRevealed(session, x, y);

      if (!isRevealed) {
        context.fillStyle = "rgba(255, 251, 245, 0.92)";
        context.fillRect(x * cellWidth, y * cellHeight, cellWidth, cellHeight);
        continue;
      }

      drawRequests.push(drawTileImage(getTileAssetUrl(tileKind, tileOrientation), x * cellWidth, y * cellHeight, cellWidth, cellHeight));

      const entityKind = normalizeEntityKind(cell?.entityKind || cell?.occupantKind || cell?.monsterKind || cell?.playerKind);
      const hasEntity = Boolean(cell?.entityKind || cell?.occupantKind || cell?.monsterKind || cell?.playerKind);
      if (hasEntity) {
        drawRequests.push(drawEntityImage(getEntityAssetUrl(entityKind), x * cellWidth, y * cellHeight, cellWidth, cellHeight));
      }
    }

    await Promise.all(drawRequests);

    if (token !== renderToken) {
      return;
    }

    context.strokeStyle = "rgba(16, 42, 60, 0.08)";
    context.lineWidth = 1;
    for (let row = 0; row <= boardHeight; row += 1) {
      const y = Math.round(row * cellHeight) + 0.5;
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(width, y);
      context.stroke();
    }
    for (let column = 0; column <= boardWidth; column += 1) {
      const x = Math.round(column * cellWidth) + 0.5;
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, height);
      context.stroke();
    }
  }

  function clearCanvas() {
    if (!canvasEl || !context) {
      return;
    }

    context.clearRect(0, 0, canvasEl.width, canvasEl.height);
  }

  async function drawTileImage(url, dx, dy, dw, dh) {
    const image = await loadImage(url);
    if (!image) {
      return;
    }

    context.drawImage(image, dx, dy, dw, dh);
  }

  async function drawEntityImage(url, dx, dy, dw, dh) {
    const image = await loadImage(url);
    if (!image) {
      return;
    }

    const inset = Math.max(2, Math.round(Math.min(dw, dh) * 0.14));
    context.drawImage(image, dx + inset, dy + inset, dw - inset * 2, dh - inset * 2);
  }

  function loadImage(url) {
    if (!url) {
      return Promise.resolve(null);
    }

    const cached = imageCache.get(url);
    if (cached) {
      return cached instanceof Promise ? cached : Promise.resolve(cached);
    }

    const pending = new Promise((resolve) => {
      const image = new Image();
      image.onload = () => {
        imageCache.set(url, image);
        resolve(image);
      };
      image.onerror = () => {
        imageCache.delete(url);
        resolve(null);
      };
      image.src = url;
    });

    imageCache.set(url, pending);
    return pending;
  }
}