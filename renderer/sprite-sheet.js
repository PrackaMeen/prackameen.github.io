import { loadImage } from './image-loader.js';

const spriteSheetCache = new Map();

export function createSpriteSheetSource(imageUrl, options = {}) {
  return {
    imageUrl,
    metadataUrl: options.metadataUrl ?? null,
    defaultFrameName: options.defaultFrameName ?? 'default'
  };
}

export function normalizeSpriteSheetSource(source) {
  if (typeof source === 'string') {
    return createSpriteSheetSource(source);
  }

  return {
    imageUrl: String(source?.imageUrl || '').trim(),
    metadataUrl: source?.metadataUrl ? String(source.metadataUrl).trim() : null,
    defaultFrameName: String(source?.defaultFrameName || 'default')
  };
}

export async function loadSpriteSheet(source, dependencies = {}) {
  const normalizedSource = normalizeSpriteSheetSource(source);
  const cacheKey = `${normalizedSource.imageUrl}::${normalizedSource.metadataUrl || ''}`;
  const cached = spriteSheetCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const loader = dependencies.loadImage ?? loadImage;
  const metadataLoader = dependencies.loadMetadata ?? loadSpriteSheetMetadata;
  const [image, metadata] = await Promise.all([
    loader(normalizedSource.imageUrl),
    normalizedSource.metadataUrl ? metadataLoader(normalizedSource.metadataUrl) : Promise.resolve(null)
  ]);

  const sheet = normalizeSpriteSheet({
    image,
    frames: metadata?.frames ?? metadata,
    defaultFrameName: normalizedSource.defaultFrameName
  });

  spriteSheetCache.set(cacheKey, sheet);
  return sheet;
}

export function resolveSpriteFrame(sheet, frameName = 'default') {
  const spriteSheet = normalizeSpriteSheet(sheet);
  const resolvedFrameName = frameName in spriteSheet.frames ? frameName : spriteSheet.defaultFrameName;
  return spriteSheet.frames[resolvedFrameName] ?? spriteSheet.frames[spriteSheet.defaultFrameName] ?? getFallbackFrame(spriteSheet.image);
}

export async function drawSpriteFrame(context, source, frameName, dx, dy, dw, dh, dependencies = {}) {
  const sheet = source && source.image && source.frames ? normalizeSpriteSheet(source) : await loadSpriteSheet(source, dependencies);
  const frame = resolveSpriteFrame(sheet, frameName);

  if (!context || !sheet.image || !frame) {
    return;
  }

  context.drawImage(sheet.image, frame.sx, frame.sy, frame.sw, frame.sh, dx, dy, dw, dh);
}

export function normalizeSpriteSheet(sheet) {
  const image = sheet?.image ?? null;
  const frames = normalizeSpriteFrames(sheet?.frames ?? sheet?.metadata?.frames ?? sheet?.metadata, image);

  return {
    image,
    frames,
    defaultFrameName: String(sheet?.defaultFrameName || 'default')
  };
}

export function normalizeSpriteFrames(rawFrames, image = null) {
  const normalizedFrames = {};
  const sourceFrames = rawFrames && typeof rawFrames === 'object' ? rawFrames : {};

  for (const [frameName, frameValue] of Object.entries(sourceFrames)) {
    const frame = normalizeFrame(frameValue);
    if (frame) {
      normalizedFrames[frameName] = frame;
    }
  }

  if (!Object.keys(normalizedFrames).length && image) {
    normalizedFrames.default = getFallbackFrame(image);
  }

  return normalizedFrames;
}

export async function loadSpriteSheetMetadata(metadataUrl, dependencies = {}) {
  const fetchJson = dependencies.fetchJson ?? fetch;
  if (!metadataUrl || typeof fetchJson !== 'function') {
    return null;
  }

  try {
    const response = await fetchJson(metadataUrl);
    if (!response?.ok || typeof response.json !== 'function') {
      return null;
    }

    return await response.json();
  } catch {
    return null;
  }
}

function normalizeFrame(frameValue) {
  if (!frameValue || typeof frameValue !== 'object') {
    return null;
  }

  const frame = frameValue.frame && typeof frameValue.frame === 'object' ? frameValue.frame : frameValue;
  const sx = Number(frame.sx ?? frame.x ?? frame.left ?? 0);
  const sy = Number(frame.sy ?? frame.y ?? frame.top ?? 0);
  const sw = Number(frame.sw ?? frame.w ?? frame.width ?? 0);
  const sh = Number(frame.sh ?? frame.h ?? frame.height ?? 0);

  if (!Number.isFinite(sx) || !Number.isFinite(sy) || !Number.isFinite(sw) || !Number.isFinite(sh) || sw <= 0 || sh <= 0) {
    return null;
  }

  return { sx, sy, sw, sh };
}

function getFallbackFrame(image) {
  return {
    sx: 0,
    sy: 0,
    sw: Math.max(1, Number(image?.width) || 1),
    sh: Math.max(1, Number(image?.height) || 1)
  };
}