const GAME_TILE_SPRITES = {
  "cross-road": ["./assets/game/tiles/Road1.png", "./assets/game/tiles/Road2.png"],
  "direct-road": ["./assets/game/tiles/Road3.png", "./assets/game/tiles/Road4.png"],
  "chamber-2-entrances": ["./assets/game/tiles/Chamber1.png", "./assets/game/tiles/Chamber2.png"],
  "chamber-4-entrances": ["./assets/game/tiles/Chamber3.png", "./assets/game/tiles/Chamber4.png"]
};

const GAME_ENTITY_SPRITES = {
  player: "./assets/game/entities/player.png",
  monster: "./assets/game/entities/monster.png"
};

const IMAGE_LOAD_CACHE = new Map();

let preloadPromise = null;

function getVersionedAssetUrl(assetPath) {
  const resolver = window.__GAME_VERSIONED_ASSET_URL__;
  if (typeof resolver === "function") {
    return resolver(assetPath);
  }

  return assetPath;
}

function normalizeTileKind(kind) {
  const normalized = String(kind || "").trim().toLowerCase().replace(/[_\s]+/g, "-");

  if (normalized in GAME_TILE_SPRITES) {
    return normalized;
  }

  if (normalized.includes("cross")) {
    return "cross-road";
  }

  if (normalized.includes("direct") || normalized.includes("road")) {
    return "direct-road";
  }

  if (normalized.includes("4")) {
    return "chamber-4-entrances";
  }

  if (normalized.includes("2")) {
    return "chamber-2-entrances";
  }

  return "cross-road";
}

function normalizeEntityKind(kind) {
  const normalized = String(kind || "").trim().toLowerCase().replace(/[_\s]+/g, "-");

  if (normalized in GAME_ENTITY_SPRITES) {
    return normalized;
  }

  if (normalized.includes("monster") || normalized.includes("enemy") || normalized.includes("boss")) {
    return "monster";
  }

  return "player";
}

function getTileAssetPath(kind) {
  const normalizedKind = normalizeTileKind(kind);
  const variants = GAME_TILE_SPRITES[normalizedKind] || GAME_TILE_SPRITES["cross-road"];
  return Array.isArray(variants) && variants.length > 0 ? variants[0] : GAME_TILE_SPRITES["cross-road"][0];
}

function getEntityAssetPath(kind) {
  return GAME_ENTITY_SPRITES[normalizeEntityKind(kind)];
}

function getTileAssetUrl(kind, seed = 0) {
  const normalizedKind = normalizeTileKind(kind);
  const variants = GAME_TILE_SPRITES[normalizedKind] || GAME_TILE_SPRITES["cross-road"];
  const seedText = String(seed || "0");
  let hash = 0;

  for (let index = 0; index < seedText.length; index += 1) {
    hash = (hash * 31 + seedText.charCodeAt(index)) >>> 0;
  }

  const index = hash % variants.length;
  return getVersionedAssetUrl(variants[index]);
}

function getEntityAssetUrl(kind) {
  return getVersionedAssetUrl(getEntityAssetPath(kind));
}

function loadImage(assetPath) {
  if (IMAGE_LOAD_CACHE.has(assetPath)) {
    return IMAGE_LOAD_CACHE.get(assetPath);
  }

  const promise = new Promise((resolve) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(true);
    image.onerror = () => resolve(false);
    image.src = getVersionedAssetUrl(assetPath);
  });

  IMAGE_LOAD_CACHE.set(assetPath, promise);
  return promise;
}

async function preloadGameAssets() {
  if (!preloadPromise) {
    const assetPaths = [
      ...Object.values(GAME_TILE_SPRITES).flat(),
      ...Object.values(GAME_ENTITY_SPRITES)
    ];

    preloadPromise = Promise.all(assetPaths.map((assetPath) => loadImage(assetPath))).then(() => undefined);
  }

  return preloadPromise;
}

function getGameTileKinds() {
  return Object.keys(GAME_TILE_SPRITES);
}

function getGameEntityKinds() {
  return Object.keys(GAME_ENTITY_SPRITES);
}

export {
  getEntityAssetPath,
  getEntityAssetUrl,
  getGameEntityKinds,
  getGameTileKinds,
  getTileAssetPath,
  getTileAssetUrl,
  normalizeEntityKind,
  normalizeTileKind,
  preloadGameAssets
};