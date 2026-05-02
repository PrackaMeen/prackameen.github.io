const TILE_DEFINITION_PATH = "./assets/game/tile-definitions.json";

const DEFAULT_TILE_DEFINITIONS = {
  road0: [
    { orientation: 0, sprite: "./assets/game/tiles/Road0_0.png", walls: { north: true, east: true, south: false, west: true } },
    { orientation: 1, sprite: "./assets/game/tiles/Road0_1.png", walls: { north: true, east: true, south: true, west: false } },
    { orientation: 2, sprite: "./assets/game/tiles/Road0_2.png", walls: { north: false, east: true, south: true, west: true } },
    { orientation: 3, sprite: "./assets/game/tiles/Road0_3.png", walls: { north: true, east: false, south: true, west: true } }
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
  player: "./assets/game/entities/player.png",
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
      return {
        orientation: normalizeOrientation(entry?.orientation, index),
        sprite: String(entry?.sprite || "").trim() || fallbackEntry.sprite,
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

function getEntityAssetPath(kind) {
  return GAME_ENTITY_SPRITES[normalizeEntityKind(kind)];
}

function getTileAssetUrl(kind, orientation = 0) {
  return getVersionedAssetUrl(getTileAssetPath(kind, orientation));
}

function getHiddenTileAssetUrl() {
  return getVersionedAssetUrl(HIDDEN_TILE_SPRITE);
}

function getTileWalls(kind, orientation = 0) {
  return normalizeWalls(getTileDefinition(kind, orientation)?.walls);
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
    const definitions = await loadTileDefinitions();
    const assetPaths = [
      ...Object.values(definitions).flatMap((entries) => entries.map((entry) => entry.sprite)),
      HIDDEN_TILE_SPRITE,
      ...Object.values(GAME_ENTITY_SPRITES)
    ];

    preloadPromise = Promise.all(assetPaths.map((assetPath) => loadImage(assetPath))).then(() => undefined);
  }

  return preloadPromise;
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
  getGameEntityKinds,
  getGameTileKinds,
  getHiddenTileAssetUrl,
  getTileAssetPath,
  getTileAssetUrl,
  getTileDefinition,
  getTileWalls,
  normalizeEntityKind,
  normalizeTileKind,
  applyTileDefinitionsFromRuntime,
  preloadGameAssets
};