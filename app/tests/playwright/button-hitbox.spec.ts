import { expect, test } from "@playwright/test";
import { inflateSync } from "node:zlib";

test.use({
  viewport: { width: 528, height: 346 }
});

const testUrl = "/";

async function addPointMarker(
  page: import("@playwright/test").Page,
  x: number,
  y: number,
  index: number,
  kind: "visual" | "click",
  style: { size: number; background: string; border: string; boxShadow: string }
): Promise<void> {
  await page.evaluate(({ x, y, index, kind, style }) => {
    const marker = document.getElementById(`${kind}-marker-${index}`) ?? document.createElement("div");

    marker.id = `${kind}-marker-${index}`;
    marker.style.position = "fixed";
    marker.style.left = `${x - style.size / 2}px`;
    marker.style.top = `${y - style.size / 2}px`;
    marker.style.width = `${style.size}px`;
    marker.style.height = `${style.size}px`;
    marker.style.borderRadius = "999px";
    marker.style.background = style.background;
    marker.style.border = style.border;
    marker.style.boxShadow = style.boxShadow;
    marker.style.zIndex = "9999";
    marker.style.pointerEvents = "none";

    if (!marker.parentElement) {
      document.body.appendChild(marker);
    }
  }, { x, y, index, kind, style });
}

function decodePng(buffer: Buffer): { width: number; height: number; pixels: Uint8Array } {
  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  if (!buffer.subarray(0, 8).equals(pngSignature)) {
    throw new Error("Expected a PNG screenshot buffer");
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idatChunks: Buffer[] = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    offset += 4;
    const chunkType = buffer.toString("ascii", offset, offset + 4);
    offset += 4;
    const chunkData = buffer.subarray(offset, offset + length);
    offset += length + 4;

    if (chunkType === "IHDR") {
      width = chunkData.readUInt32BE(0);
      height = chunkData.readUInt32BE(4);
      bitDepth = chunkData.readUInt8(8);
      colorType = chunkData.readUInt8(9);
    } else if (chunkType === "IDAT") {
      idatChunks.push(chunkData);
    } else if (chunkType === "IEND") {
      break;
    }
  }

  if (width <= 0 || height <= 0) {
    throw new Error("Invalid PNG dimensions");
  }

  if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) {
    throw new Error(`Unsupported PNG format: bitDepth=${bitDepth}, colorType=${colorType}`);
  }

  const bytesPerPixel = colorType === 2 ? 3 : 4;
  const raw = inflateSync(Buffer.concat(idatChunks));
  const pixels = new Uint8Array(width * height * 4);
  const currentRow = Buffer.alloc(width * bytesPerPixel);
  const previousRow = Buffer.alloc(width * bytesPerPixel);
  let rawOffset = 0;

  const paethPredictor = (left: number, above: number, upperLeft: number): number => {
    const estimate = left + above - upperLeft;
    const leftDistance = Math.abs(estimate - left);
    const aboveDistance = Math.abs(estimate - above);
    const upperLeftDistance = Math.abs(estimate - upperLeft);

    if (leftDistance <= aboveDistance && leftDistance <= upperLeftDistance) {
      return left;
    }

    if (aboveDistance <= upperLeftDistance) {
      return above;
    }

    return upperLeft;
  };

  for (let row = 0; row < height; row += 1) {
    const filterType = raw[rawOffset];
    rawOffset += 1;
    const scanline = raw.subarray(rawOffset, rawOffset + width * bytesPerPixel);
    rawOffset += width * bytesPerPixel;

    for (let column = 0; column < width * bytesPerPixel; column += 1) {
      const left = column >= bytesPerPixel ? currentRow[column - bytesPerPixel] : 0;
      const above = previousRow[column];
      const upperLeft = column >= bytesPerPixel ? previousRow[column - bytesPerPixel] : 0;
      const value = scanline[column];

      switch (filterType) {
        case 0:
          currentRow[column] = value;
          break;
        case 1:
          currentRow[column] = (value + left) & 0xff;
          break;
        case 2:
          currentRow[column] = (value + above) & 0xff;
          break;
        case 3:
          currentRow[column] = (value + Math.floor((left + above) / 2)) & 0xff;
          break;
        case 4:
          currentRow[column] = (value + paethPredictor(left, above, upperLeft)) & 0xff;
          break;
        default:
          throw new Error(`Unsupported PNG filter type: ${filterType}`);
      }
    }

    for (let column = 0; column < width; column += 1) {
      const source = column * bytesPerPixel;
      const target = (row * width + column) * 4;

      pixels[target] = currentRow[source];
      pixels[target + 1] = currentRow[source + 1];
      pixels[target + 2] = currentRow[source + 2];
      pixels[target + 3] = bytesPerPixel === 4 ? currentRow[source + 3] : 255;
    }

    currentRow.copy(previousRow);
  }

  return { width, height, pixels };
}

function colorDistance(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  return Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2);
}

function findSolidColorBounds(
  image: { width: number; height: number; pixels: Uint8Array },
  target: { r: number; g: number; b: number },
  tolerance = 18,
  searchArea?: { left: number; top: number; right: number; bottom: number }
): { left: number; top: number; right: number; bottom: number } | null {
  const minimumX = Math.max(0, Math.floor(searchArea?.left ?? 0));
  const minimumY = Math.max(0, Math.floor(searchArea?.top ?? 0));
  const maximumX = Math.min(image.width - 1, Math.ceil(searchArea?.right ?? (image.width - 1)));
  const maximumY = Math.min(image.height - 1, Math.ceil(searchArea?.bottom ?? (image.height - 1)));

  let left = Number.POSITIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;

  for (let y = minimumY; y <= maximumY; y += 1) {
    for (let x = minimumX; x <= maximumX; x += 1) {
      const offset = (y * image.width + x) * 4;
      const distance = colorDistance(image.pixels[offset], image.pixels[offset + 1], image.pixels[offset + 2], target.r, target.g, target.b);

      if (distance <= tolerance) {
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
      }
    }
  }

  if (!Number.isFinite(left) || !Number.isFinite(top) || !Number.isFinite(right) || !Number.isFinite(bottom)) {
    return null;
  }

  return { left, top, right, bottom };
}

test("Settings button opens the settings scene", async ({ page }, testInfo) => {
  await page.goto(testUrl);
  await expect(page.locator("canvas#game")).toBeVisible();
  await expect.poll(async () => page.evaluate(() => (globalThis as typeof globalThis & { __activeSceneName?: string }).__activeSceneName)).toBe("menu");

  const canvasMetrics = await page.evaluate(() => {
    const canvas = document.querySelector("canvas#game") as HTMLCanvasElement | null;

    if (!canvas) {
      return null;
    }

    const rect = canvas.getBoundingClientRect();

    return {
      left: rect.left,
      top: rect.top,
      width: canvas.width,
      height: canvas.height,
      clientWidth: rect.width,
      clientHeight: rect.height
    };
  });

  if (!canvasMetrics) {
    throw new Error("Expected canvas metrics to be available");
  }

  const screenshotPath = testInfo.outputPath("settings-menu-canvas.png");
  const canvasBox = await page.locator("canvas#game").boundingBox();

  if (!canvasBox) {
    throw new Error("Expected the canvas bounding box to be available");
  }

  for (let index = 0; index < 4; index += 1) {
    await page.goto(testUrl);
    await expect.poll(async () => page.evaluate(() => (globalThis as typeof globalThis & { __activeSceneName?: string }).__activeSceneName)).toBe("menu");

    const loopCanvasBox = await page.locator("canvas#game").boundingBox();

    if (!loopCanvasBox) {
      throw new Error("Expected the canvas bounding box to be available after reload");
    }

    const loopCanvasMetrics = await page.evaluate(() => {
      const canvas = document.querySelector("canvas#game") as HTMLCanvasElement | null;

      if (!canvas) {
        return null;
      }

      const rect = canvas.getBoundingClientRect();

      return {
        left: rect.left,
        top: rect.top,
        width: canvas.width,
        height: canvas.height,
        clientWidth: rect.width,
        clientHeight: rect.height
      };
    });

    if (!loopCanvasMetrics) {
      throw new Error("Expected canvas metrics to be available after reload");
    }

    const loopButtonBox = await page.evaluate(() => (globalThis as typeof globalThis & {
      __menuButtonRects?: { settings: { left: number; top: number; right: number; bottom: number } };
    }).__menuButtonRects?.settings ?? null);

    if (!loopButtonBox) {
      throw new Error("Expected menu button bounds to be exposed after reload");
    }

    const loopRenderScaleX = loopCanvasMetrics.clientWidth / loopCanvasMetrics.width;
    const loopRenderScaleY = loopCanvasMetrics.clientHeight / loopCanvasMetrics.height;
    const loopProjectedButtonBox = {
      left: loopButtonBox.left * loopRenderScaleX,
      top: loopButtonBox.top * loopRenderScaleY,
      right: loopButtonBox.right * loopRenderScaleX,
      bottom: loopButtonBox.bottom * loopRenderScaleY
    };

    const loopCanvasScreenshot = decodePng(await page.screenshot({ clip: loopCanvasBox }));
    const loopVisualButtonBounds = findSolidColorBounds(loopCanvasScreenshot, { r: 26, g: 41, b: 72 }, 24, {
      left: Math.max(0, loopProjectedButtonBox.left - loopCanvasBox.x - 50),
      top: Math.max(0, loopProjectedButtonBox.top - loopCanvasBox.y - 50),
      right: Math.min(loopCanvasScreenshot.width - 1, loopProjectedButtonBox.right - loopCanvasBox.x + 50),
      bottom: Math.min(loopCanvasScreenshot.height - 1, loopProjectedButtonBox.bottom - loopCanvasBox.y + 50)
    });

    if (!loopVisualButtonBounds) {
      throw new Error("Expected to find the visible Settings button in the screenshot");
    }

    const loopVisualButtonBox = {
      left: loopCanvasBox.x + loopVisualButtonBounds.left * (loopCanvasBox.width / loopCanvasScreenshot.width),
      top: loopCanvasBox.y + loopVisualButtonBounds.top * (loopCanvasBox.height / loopCanvasScreenshot.height),
      right: loopCanvasBox.x + loopVisualButtonBounds.right * (loopCanvasBox.width / loopCanvasScreenshot.width),
      bottom: loopCanvasBox.y + loopVisualButtonBounds.bottom * (loopCanvasBox.height / loopCanvasScreenshot.height)
    };

    console.log(JSON.stringify({
      loopCanvasBox,
      screenshot: { width: loopCanvasScreenshot.width, height: loopCanvasScreenshot.height },
      loopVisualButtonBounds,
      loopVisualButtonBox
    }));

    const cornerClicks = [
      { x: loopVisualButtonBox.left + 1, y: Math.round(loopVisualButtonBox.top) },
      { x: loopVisualButtonBox.right - 1, y: Math.round(loopVisualButtonBox.top) },
      { x: loopVisualButtonBox.right - 1, y: Math.round(loopVisualButtonBox.bottom) - 1 },
      { x: loopVisualButtonBox.left + 1, y: Math.round(loopVisualButtonBox.bottom) - 1 }
    ];

    const { x, y } = cornerClicks[index];
    const pageX = x;
    const pageY = y;

    console.log(JSON.stringify({ pageX, pageY }));

    await addPointMarker(page, pageX, pageY, index, "visual", {
      size: 12,
      background: "rgba(34, 197, 94, 0.18)",
      border: "2px solid rgba(34, 197, 94, 0.98)",
      boxShadow: "0 0 0 2px rgba(16, 185, 129, 0.28)"
    });

    const screenshotPath = testInfo.outputPath(`settings-corner-${index + 1}-${Math.round(x)}-${Math.round(y)}.png`);
    await page.evaluate(({ pageX, pageY }) => {
      (globalThis as typeof globalThis & { __lastMenuPointer?: { x: number; y: number }; __lastMenuHitTarget?: string | null }).__lastMenuPointer = undefined;
      (globalThis as typeof globalThis & { __lastMenuPointer?: { x: number; y: number }; __lastMenuHitTarget?: string | null }).__lastMenuHitTarget = undefined;

      const canvas = document.querySelector("canvas#game");

      if (!canvas) {
        throw new Error("Expected the game canvas to be present");
      }

      const bounds = canvas.getBoundingClientRect();
      const clientX = pageX;
      const clientY = pageY;
      const dispatch = (type: string, buttons: number) => {
        canvas.dispatchEvent(new PointerEvent(type, {
          bubbles: true,
          pointerId: 1,
          pointerType: "mouse",
          isPrimary: true,
          button: 0,
          buttons,
          clientX,
          clientY
        }));
      };

      console.log("[button-hit-test] dispatch", {
        pagePoint: { x: pageX, y: pageY },
        canvasOffset: { x: bounds.left, y: bounds.top },
        clientPoint: { x: clientX, y: clientY }
      });

      dispatch("pointermove", 0);
      dispatch("pointerdown", 1);
      dispatch("pointerup", 0);
    }, { pageX, pageY });

    const clickState = await page.evaluate(() => ({
      hitTarget: (globalThis as typeof globalThis & { __lastMenuHitTarget?: string | null }).__lastMenuHitTarget ?? null,
      pointer: (globalThis as typeof globalThis & { __lastMenuPointer?: { x: number; y: number } }).__lastMenuPointer ?? null,
      activeScene: (globalThis as typeof globalThis & { __activeSceneName?: string }).__activeSceneName ?? null
    }));

    if (clickState.pointer) {
      await addPointMarker(page, clickState.pointer.x, clickState.pointer.y, index, "click", {
        size: 8,
        background: "rgba(239, 68, 68, 0.98)",
        border: "2px solid rgba(153, 27, 27, 1)",
        boxShadow: "0 0 0 2px rgba(255, 255, 255, 0.55)"
      });
    }

    await page.screenshot({
      path: screenshotPath,
      clip: {
        x: Math.max(0, loopVisualButtonBox.left - 12),
        y: Math.max(0, loopVisualButtonBox.top - 12),
        width: (loopVisualButtonBox.right - loopVisualButtonBox.left) + 24,
        height: (loopVisualButtonBox.bottom - loopVisualButtonBox.top) + 24
      }
    });
    await testInfo.attach(`settings-corner-${index + 1}`, {
      path: screenshotPath,
      contentType: "image/png"
    });

    await expect.poll(async () => page.evaluate(() => (globalThis as typeof globalThis & { __activeSceneName?: string }).__activeSceneName ?? null)).toBe("settings");
    if (clickState.hitTarget !== null) {
      expect(
        clickState.hitTarget,
        `expected the visible corner click to hit Settings, got ${clickState.hitTarget} at pointer ${clickState.pointer ? `${clickState.pointer.x},${clickState.pointer.y}` : "<missing>"} from intended ${pageX},${pageY}`
      ).toBe("settings");
    }
  }
});