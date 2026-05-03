const TILE_DEFINITION_PATH = "./assets/game/tile-definitions.json";

const ROAD0_ANIMATION = {
  frameNames: ["frame-0", "frame-1", "frame-2", "frame-3"],
  frameDurationMs: 120,
  loop: true
};

const DEFAULT_TILE_DEFINITIONS = {
  road0: [
    { orientation: 0, sprite: "./assets/game/tiles/Road0/Road0_0.png", animation: ROAD0_ANIMATION, walls: { north: true, east: true, south: false, west: true } },
    { orientation: 1, sprite: "./assets/game/tiles/Road0/Road0_1.png", animation: ROAD0_ANIMATION, walls: { north: true, east: true, south: true, west: false } },
    { orientation: 2, sprite: "./assets/game/tiles/Road0/Road0_2.png", animation: ROAD0_ANIMATION, walls: { north: false, east: true, south: true, west: true } },
    { orientation: 3, sprite: "./assets/game/tiles/Road0/Road0_3.png", animation: ROAD0_ANIMATION, walls: { north: true, east: false, south: true, west: true } }
  ],
  road1: [
    { orientation: 0, sprite: "./assets/game/tiles/Road1_0.png", walls: { north: false, east: true, south: false, west: true } },
    { orientation: 1, sprite: "./assets/game/tiles/Road1_1.png", walls: { north: true, east: false, south: true, west: false } },
    { orientation: 2, sprite: "./assets/game/tiles/Road1_2.png", walls: { north: false, east: true, south: false, west: true } },
    { orientation: 3, sprite: "./assets/game/tiles/Road1_3.png", walls: { north: true, east: false, south: true, west: false } }
  ],
  road2: [
    { orientation: 0, sprite: "./assets/game/tiles/Road2_0.png", walls: { north: false, east: true, south: true, west: false } },
    { orientation: 1, sprite: "./assets/game/tiles/Road2_1.png", walls: { north: true, east: true, south: false, west: false } },
    { orientation: 2, sprite: "./assets/game/tiles/Road2_2.png", walls: { north: false, east: true, south: true, west: false } },
    { orientation: 3, sprite: "./assets/game/tiles/Road2_3.png", walls: { north: false, east: false, south: true, west: true } }
  ],
  road3: [
    { orientation: 0, sprite: "./assets/game/tiles/Road3_0.png", walls: { north: false, east: false, south: false, west: true } },
    { orientation: 1, sprite: "./assets/game/tiles/Road3_1.png", walls: { north: false, east: false, south: false, west: true } },
    { orientation: 2, sprite: "./assets/game/tiles/Road3_2.png", walls: { north: true, east: false, south: false, west: false } },
    { orientation: 3, sprite: "./assets/game/tiles/Road3_3.png", walls: { north: false, east: true, south: false, west: false } }
  ],
  road4: [
    { orientation: 0, sprite: "./assets/game/tiles/Road4_0.png", walls: { north: false, east: false, south: false, west: false } },
    { orientation: 1, sprite: "./assets/game/tiles/Road4_1.png", walls: { north: false, east: false, south: false, west: false } },
    { orientation: 2, sprite: "./assets/game/tiles/Road4_2.png", walls: { north: false, east: false, south: false, west: false } },
    { orientation: 3, sprite: "./assets/game/tiles/Road4_3.png", walls: { north: false, east: false, south: false, west: false } }
  ],
  chamber0: [
    { orientation: 0, sprite: "./assets/game/tiles/Chamber0_0.png", walls: { north: true, east: true, south: false, west: true } },
    { orientation: 1, sprite: "./assets/game/tiles/Chamber0_1.png", walls: { north: true, east: true, south: true, west: false } },
    { orientation: 2, sprite: "./assets/game/tiles/Chamber0_2.png", walls: { north: false, east: true, south: true, west: true } },
    { orientation: 3, sprite: "./assets/game/tiles/Chamber0_3.png", walls: { north: true, east: false, south: true, west: true } }
  ],
  chamber1: [
    { orientation: 0, sprite: "./assets/game/tiles/Chamber1_0.png", walls: { north: false, east: true, south: false, west: true } },
    { orientation: 1, sprite: "./assets/game/tiles/Chamber1_1.png", walls: { north: true, east: false, south: true, west: false } },
    { orientation: 2, sprite: "./assets/game/tiles/Chamber1_2.png", walls: { north: false, east: true, south: false, west: true } },
    { orientation: 3, sprite: "./assets/game/tiles/Chamber1_3.png", walls: { north: true, east: false, south: true, west: false } }
  ],
  chamber2: [
    { orientation: 0, sprite: "./assets/game/tiles/Chamber2_0.png", walls: { north: false, east: true, south: true, west: false } },
    { orientation: 1, sprite: "./assets/game/tiles/Chamber2_1.png", walls: { north: true, east: true, south: false, west: false } },
    { orientation: 2, sprite: "./assets/game/tiles/Chamber2_2.png", walls: { north: false, east: true, south: true, west: false } },
    { orientation: 3, sprite: "./assets/game/tiles/Chamber2_3.png", walls: { north: false, east: false, south: true, west: true } }
  ],
  chamber3: [
    { orientation: 0, sprite: "./assets/game/tiles/Chamber3_0.png", walls: { north: false, east: false, south: false, west: true } },
    { orientation: 1, sprite: "./assets/game/tiles/Chamber3_1.png", walls: { north: false, east: false, south: false, west: true } },
    { orientation: 2, sprite: "./assets/game/tiles/Chamber3_2.png", walls: { north: true, east: false, south: false, west: false } },
    { orientation: 3, sprite: "./assets/game/tiles/Chamber3_3.png", walls: { north: false, east: true, south: false, west: false } }
  ],
  chamber4: [
    { orientation: 0, sprite: "./assets/game/tiles/Chamber4_0.png", walls: { north: false, east: false, south: false, west: false } },
    { orientation: 1, sprite: "./assets/game/tiles/Chamber4_1.png", walls: { north: false, east: false, south: false, west: false } },
    { orientation: 2, sprite: "./assets/game/tiles/Chamber4_2.png", walls: { north: false, east: false, south: false, west: false } },
    { orientation: 3, sprite: "./assets/game/tiles/Chamber4_3.png", walls: { north: false, east: false, south: false, west: false } }
  ]
};

const GAME_ENTITY_SPRITES = {
  player: {
    selected: "./assets/game/entities/Char0/Char0",
    unselected: "./assets/game/entities/Char1/Char1",
    fallback: "./assets/game/entities/player.png"
  },
  monster: "./assets/game/entities/monster.png"
};

const HIDDEN_TILE_SPRITE = "./assets/game/tiles/Hidden.png";

const IMAGE_LOAD_CACHE = new Map();

let preloadPromise = null;
let tileDefinitionsPromise = null;
let tileDefinitions = null;

function getVersionedAssetUrl(assetPath) {
  const resolver = window.__GAME_VERSIONED_ASSET_URL__;
  if (typeof resolver === "function") {
    return resolver(assetPath);
  }

  return assetPath;
}

function normalizeOrientation(value, fallbackIndex = 0) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return fallbackIndex % 4;
  }

  return ((parsed % 4) + 4) % 4;
}

function normalizeWalls(walls) {
  return {
    north: Boolean(walls?.north),
    east: Boolean(walls?.east),
    south: Boolean(walls?.south),
    west: Boolean(walls?.west)
  };
}

function normalizeTileDefinitions(rawDefinitions) {
  const source = rawDefinitions && typeof rawDefinitions === "object"
    ? rawDefinitions.tileKinds || rawDefinitions
    : null;
  const baseDefinitions = source && Object.keys(source).length > 0 ? source : DEFAULT_TILE_DEFINITIONS;

  const normalized = {};
  for (const [kind, orientations] of Object.entries(baseDefinitions)) {
    const list = Array.isArray(orientations) ? orientations : [];
    const fallbackList = DEFAULT_TILE_DEFINITIONS[kind] || DEFAULT_TILE_DEFINITIONS["cross-road"];

    normalized[kind] = list.map((entry, index) => {
      const fallbackEntry = fallbackList[index % fallbackList.length];
      const animation = normalizeAnimation(entry?.animation) ?? normalizeAnimation(fallbackEntry.animation) ?? (kind === "road0" ? ROAD0_ANIMATION : null);
      return {
        orientation: normalizeOrientation(entry?.orientation, index),
        sprite: String(entry?.sprite || "").trim() || fallbackEntry.sprite,
        animation,
        walls: normalizeWalls(entry?.walls)
      };
    });
  }

  return normalized;
}

async function loadTileDefinitions() {
  if (tileDefinitions) {
    return tileDefinitions;
  }

  if (!tileDefinitionsPromise) {
    tileDefinitionsPromise = fetch(getVersionedAssetUrl(TILE_DEFINITION_PATH))
      .then(async (response) => {
        if (!response.ok) {
          return normalizeTileDefinitions(null);
        }

        try {
          return normalizeTileDefinitions(await response.json());
        } catch {
          return normalizeTileDefinitions(null);
        }
      })
      .catch(() => normalizeTileDefinitions(null))
      .then((definitions) => {
        tileDefinitions = definitions;
        return definitions;
      });
  }

  return tileDefinitionsPromise;
}

function applyTileDefinitionsFromRuntime(rawDefinitions) {
  const normalized = normalizeTileDefinitions(rawDefinitions);
  tileDefinitions = normalized;
  tileDefinitionsPromise = Promise.resolve(normalized);
  return normalized;
}

function normalizeTileKind(kind) {
  const normalized = String(kind || "").trim().toLowerCase().replace(/[_\s]+/g, "-");

  if (normalized in DEFAULT_TILE_DEFINITIONS) {
    return normalized;
  }

  const numericMatch = normalized.match(/^(road|chamber)([0-4])$/);
  if (numericMatch) {
    return `${numericMatch[1]}${numericMatch[2]}`;
  }

  if (normalized.includes("cross")) {
    return "road4";
  }

  if (normalized.includes("direct") || normalized.includes("road")) {
    return "road1";
  }

  if (normalized.includes("4")) {
    return "chamber4";
  }

  if (normalized.includes("2")) {
    return "chamber2";
  }

  return "road4";
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

function getTileDefinition(kind, orientation = 0) {
  const normalizedKind = normalizeTileKind(kind);
  const variants = tileDefinitions?.[normalizedKind] || DEFAULT_TILE_DEFINITIONS[normalizedKind] || DEFAULT_TILE_DEFINITIONS["cross-road"];
  if (!variants.length) {
    return null;
  }

  const normalizedOrientation = normalizeOrientation(orientation, 0);
  return variants[normalizedOrientation % variants.length];
}

function getTileAssetPath(kind, orientation = 0) {
  return getTileDefinition(kind, orientation)?.sprite || DEFAULT_TILE_DEFINITIONS["cross-road"][0].sprite;
}

function getEntityAssetPath(kind, options = {}) {
  const normalizedKind = normalizeEntityKind(kind);
  const entitySprite = GAME_ENTITY_SPRITES[normalizedKind];

  if (!entitySprite) {
    return GAME_ENTITY_SPRITES.player.unselected;
  }

  if (normalizedKind !== "player") {
    return entitySprite;
  }

  const orientation = normalizeOrientation(options.orientation, 0);
  const variantPath = options.selected ? entitySprite.selected : entitySprite.unselected;
  return `${variantPath}_${orientation}.png`;
}

function getTileAssetUrl(kind, orientation = 0) {
  return getVersionedAssetUrl(getTileAssetPath(kind, orientation));
}

function getTileSpriteSheetSource(kind, orientation = 0) {
  const tileDefinition = getTileDefinition(kind, orientation);
  return getSpriteSheetSource(getTileAssetPath(kind, orientation), {
    defaultFrameName: tileDefinition?.animation?.defaultFrameName || "frame-0",
    animation: tileDefinition?.animation || null
  });
}

function getHiddenTileAssetUrl() {
  return getVersionedAssetUrl(HIDDEN_TILE_SPRITE);
}

function getHiddenTileSpriteSheetSource() {
  return getSpriteSheetSource(HIDDEN_TILE_SPRITE);
}

function getTileWalls(kind, orientation = 0) {
  return normalizeWalls(getTileDefinition(kind, orientation)?.walls);
}

function getEntityAssetUrl(kind, options = {}) {
  return getVersionedAssetUrl(getEntityAssetPath(kind, options));
}

function getEntitySpriteSheetSource(kind, options = {}) {
  return getSpriteSheetSource(getEntityAssetPath(kind, options));
}

function getSpriteSheetSource(assetPath, options = {}) {
  const versionedAssetPath = getVersionedAssetUrl(assetPath);
  const metadataAssetPath = getMetadataAssetPath(versionedAssetPath);

  return {
    imageUrl: versionedAssetPath,
    metadataUrl: metadataAssetPath,
    defaultFrameName: String(options.defaultFrameName || 'default'),
    animation: normalizeAnimation(options.animation)
  };
}

function normalizeAnimation(animation) {
  if (!animation || typeof animation !== 'object') {
    return null;
  }

  const frameNames = Array.isArray(animation.frameNames)
    ? animation.frameNames.filter((frameName) => typeof frameName === 'string' && frameName.length > 0)
    : [];

  if (!frameNames.length) {
    return null;
  }

  return {
    frameNames,
    frameDurationMs: Number.isFinite(Number(animation.frameDurationMs)) ? Number(animation.frameDurationMs) : 120,
    loop: animation.loop !== false,
    defaultFrameName: typeof animation.defaultFrameName === 'string' && animation.defaultFrameName.length > 0 ? animation.defaultFrameName : frameNames[0]
  };
}

function getMetadataAssetPath(assetPath) {
  const queryIndex = assetPath.indexOf('?');
  const hashIndex = assetPath.indexOf('#');
  const endIndex = queryIndex >= 0
    ? queryIndex
    : hashIndex >= 0
      ? hashIndex
      : assetPath.length;
  const basePath = assetPath.slice(0, endIndex);
  const suffix = assetPath.slice(endIndex);

  if (/\.png$/i.test(basePath)) {
    return `${basePath.slice(0, -4)}.json${suffix}`;
  }

  return assetPath;
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
    const definitions = await loadTileDefinitions();
    const assetPaths = [
      ...Object.values(definitions).flatMap((entries) => entries.map((entry) => entry.sprite)),
      HIDDEN_TILE_SPRITE,
      GAME_ENTITY_SPRITES.player.fallback,
      ...Object.values(GAME_ENTITY_SPRITES).flatMap((sprite) => typeof sprite === "string" ? [sprite] : [sprite.selected, sprite.unselected])
    ];

    preloadPromise = Promise.all(assetPaths.map((assetPath) => loadImage(assetPath))).then(() => undefined);
  }

  return preloadPromise;
}

async function loadAnimatedSpriteSources() {
  const definitions = await loadTileDefinitions();
  const animatedSources = [];

  for (const [kind, entries] of Object.entries(definitions)) {
    if (!Array.isArray(entries)) {
      continue;
    }

    for (const entry of entries) {
      if (!entry?.animation?.frameNames?.length || entry.animation.frameNames.length <= 1) {
        continue;
      }

      const orientation = Number.isInteger(entry.orientation) ? entry.orientation : 0;
      animatedSources.push({
        id: `${kind}:${orientation}`,
        kind,
        orientation,
        label: `${kind.charAt(0).toUpperCase()}${kind.slice(1)} / orientation ${orientation}`,
        source: getTileSpriteSheetSource(kind, orientation),
        animation: entry.animation
      });
    }
  }

  return animatedSources.sort((left, right) => left.label.localeCompare(right.label));
}

function getGameTileKinds() {
  return Object.keys(DEFAULT_TILE_DEFINITIONS);
}

function getGameEntityKinds() {
  return Object.keys(GAME_ENTITY_SPRITES);
}

export {
  getEntityAssetPath,
  getEntityAssetUrl,
  getEntitySpriteSheetSource,
  getGameEntityKinds,
  getGameTileKinds,
  getHiddenTileAssetUrl,
  getHiddenTileSpriteSheetSource,
  getTileAssetPath,
  getTileAssetUrl,
  getTileSpriteSheetSource,
  getTileDefinition,
  getTileWalls,
  normalizeEntityKind,
  normalizeTileKind,
  applyTileDefinitionsFromRuntime,
  loadAnimatedSpriteSources,
  preloadGameAssets
};