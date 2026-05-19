import { getTrailTileVersion, type TrailTileVersion, USED_TRAIL_TILE_ASSET_NAMES } from "./config";

export type AssetSourceKind = "asset" | "spriteSheet";

export type AssetCategory = "character" | "trailTile" | "monster" | "treasure" | "hud";

export interface AssetCatalogEntry {
  assetName: string;
  sourceKind: AssetSourceKind;
  path: string;
  category: AssetCategory;
  spriteSheetRows?: number;
}

export type TrailTileRenderKind = "grid" | "horizontalStrip";

export interface TrailTileDefinition {
  assetName: string;
  sourceAssetNames: string[];
  renderKind: TrailTileRenderKind;
  spriteSheetRows?: number;
  frameCount?: number;
}

export const assetCatalog: AssetCatalogEntry[] = [
  { assetName: "char0", sourceKind: "spriteSheet", path: "Character0/Character0.png", category: "character" },
  { assetName: "char1", sourceKind: "asset", path: "chars/Char1_2.png", category: "character" },
  { assetName: "road0", sourceKind: "spriteSheet", path: "Road0/Road0.png", category: "trailTile" },
  { assetName: "road1", sourceKind: "spriteSheet", path: "Road1/Road1.png", category: "trailTile" },
  { assetName: "road2", sourceKind: "spriteSheet", path: "Road2/Road2.png", category: "trailTile" },
  { assetName: "road3", sourceKind: "spriteSheet", path: "Road3/Road3.png", category: "trailTile" },
  { assetName: "road4", sourceKind: "spriteSheet", path: "Road4/Road4.png", category: "trailTile" },
  { assetName: "fountain4", sourceKind: "spriteSheet", path: "Fountain4/Fountain4.png", category: "trailTile", spriteSheetRows: 1 },
  { assetName: "chamber0", sourceKind: "spriteSheet", path: "Chamber0/Chamber0.png", category: "trailTile" },
  { assetName: "chamber1", sourceKind: "spriteSheet", path: "Chamber1/Chamber1.png", category: "trailTile" },
  { assetName: "chamber2", sourceKind: "spriteSheet", path: "Chamber2/Chamber2.png", category: "trailTile" },
  { assetName: "chamber3", sourceKind: "spriteSheet", path: "Chamber3/Chamber3.png", category: "trailTile" },
  { assetName: "chamber4", sourceKind: "spriteSheet", path: "Chamber4/Chamber4.png", category: "trailTile" },
  { assetName: "road0-v2", sourceKind: "spriteSheet", path: "Road0/Road0-v2.png", category: "trailTile" },
  { assetName: "road1-v2", sourceKind: "spriteSheet", path: "Road1/Road1-v2.png", category: "trailTile" },
  { assetName: "road2-v2", sourceKind: "spriteSheet", path: "Road2/Road2-v2.png", category: "trailTile" },
  { assetName: "road3-v2", sourceKind: "spriteSheet", path: "Road3/road3-v2.png", category: "trailTile" },
  { assetName: "road4-v2", sourceKind: "spriteSheet", path: "Road4/road4-v2.png", category: "trailTile" },
  { assetName: "chamber0-v2", sourceKind: "spriteSheet", path: "Chamber0/Chamber0-v2.png", category: "trailTile" },
  { assetName: "chamber1-v2", sourceKind: "spriteSheet", path: "Chamber1/Chamber1-v2.png", category: "trailTile" },
  { assetName: "chamber2-v2", sourceKind: "spriteSheet", path: "Chamber2/Chamber2-v2.png", category: "trailTile" },
  { assetName: "chamber3-v2", sourceKind: "spriteSheet", path: "Chamber3/Chamber3-v2.png", category: "trailTile" },
  { assetName: "chamber4-v2", sourceKind: "spriteSheet", path: "Chamber4/Chamber4-v2.png", category: "trailTile" },
  { assetName: "monster0", sourceKind: "spriteSheet", path: "Monster0/Monster0.png", category: "monster" },
  { assetName: "monster1", sourceKind: "spriteSheet", path: "Monster1/Monster1.png", category: "monster" },
  { assetName: "monster2", sourceKind: "spriteSheet", path: "Monster2/Monster2.png", category: "monster" },
  { assetName: "monster3", sourceKind: "spriteSheet", path: "Monster3/Monster3.png", category: "monster" },
  { assetName: "monster4", sourceKind: "spriteSheet", path: "Monster4/Monster4.png", category: "monster" },
  { assetName: "monster5", sourceKind: "spriteSheet", path: "Monster5/Monster5.png", category: "monster" },
  { assetName: "treasure0", sourceKind: "spriteSheet", path: "Treasure0/Treasure0.png", category: "treasure" },
  { assetName: "heart0", sourceKind: "spriteSheet", path: "Hearth0/Hearth0.png", category: "hud" },
  { assetName: "heart1", sourceKind: "spriteSheet", path: "Hearth1/Hearth1.png", category: "hud" }
];

const trailTileDefinitionsByVersion: Record<TrailTileVersion, TrailTileDefinition[]> = {
  v1: [
    { assetName: "road0", sourceAssetNames: ["road0"], renderKind: "grid" },
    { assetName: "road1", sourceAssetNames: ["road1"], renderKind: "grid" },
    { assetName: "road2", sourceAssetNames: ["road2"], renderKind: "grid" },
    { assetName: "road3", sourceAssetNames: ["road3"], renderKind: "grid" },
    { assetName: "road4", sourceAssetNames: ["road4"], renderKind: "grid" },
    { assetName: "fountain4", sourceAssetNames: ["fountain4"], renderKind: "grid", spriteSheetRows: 1 },
    { assetName: "chamber0", sourceAssetNames: ["chamber0"], renderKind: "grid" },
    { assetName: "chamber1", sourceAssetNames: ["chamber1"], renderKind: "grid" },
    { assetName: "chamber2", sourceAssetNames: ["chamber2"], renderKind: "grid" },
    { assetName: "chamber3", sourceAssetNames: ["chamber3"], renderKind: "grid" },
    { assetName: "chamber4", sourceAssetNames: ["chamber4"], renderKind: "grid" }
  ],
  v2: [
    { assetName: "road0", sourceAssetNames: ["road0-v2"], renderKind: "grid" },
    { assetName: "road1", sourceAssetNames: ["road1-v2"], renderKind: "grid" },
    { assetName: "road2", sourceAssetNames: ["road2-v2"], renderKind: "grid" },
    { assetName: "road3", sourceAssetNames: ["road3-v2"], renderKind: "grid" },
    { assetName: "road4", sourceAssetNames: ["road4-v2"], renderKind: "grid" },
    { assetName: "fountain4", sourceAssetNames: ["fountain4"], renderKind: "grid", spriteSheetRows: 1 },
    { assetName: "chamber0", sourceAssetNames: ["chamber0-v2"], renderKind: "grid" },
    { assetName: "chamber1", sourceAssetNames: ["chamber1-v2"], renderKind: "grid" },
    { assetName: "chamber2", sourceAssetNames: ["chamber2-v2"], renderKind: "grid" },
    { assetName: "chamber3", sourceAssetNames: ["chamber3-v2"], renderKind: "grid" },
    { assetName: "chamber4", sourceAssetNames: ["chamber4-v2"], renderKind: "grid" }
  ]
};

const usedTrailTileAssetNameSet = new Set<string>(USED_TRAIL_TILE_ASSET_NAMES);

export function getTrailTileDefinitions(): TrailTileDefinition[] {
  const trailTileVersion = getTrailTileVersion();

  return trailTileDefinitionsByVersion[trailTileVersion].filter((definition) => usedTrailTileAssetNameSet.has(definition.assetName));
}

export function getTrailTileAssetNames(): string[] {
  return getTrailTileDefinitions().map((definition) => definition.assetName);
}

export const trailTileDefinitions = getTrailTileDefinitions();
export const trailTileAssetNames = getTrailTileAssetNames();
export const monsterSpriteAnimationIds = assetCatalog.filter((asset) => asset.category === "monster").map((asset) => asset.assetName);
export const treasureSpriteAnimationIds = assetCatalog.filter((asset) => asset.category === "treasure").map((asset) => asset.assetName);
