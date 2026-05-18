import { Animation, AnimationStrategy, Color, ImageSource, Sprite, SpriteSheet, type Animation as AnimationGraphic, type Graphic } from "excalibur";
import {
  CHAR_SIZE,
  GAME_HEIGHT,
  GAME_WIDTH,
  HEART_ANIMATION_FRAME_DURATION,
  HEART_FRAME_COUNT,
  HEART_SCALE_FACTOR,
  HEART_SIZE_MAX,
  HEART_SIZE_MIN,
  HUD_HEIGHT_MAX,
  HUD_HEIGHT_MIN,
  HUD_HEIGHT_RATIO,
  TILE_SIZE,
  TREASURE_ANIMATION_FRAME_COUNT,
  TREASURE_ANIMATION_FRAME_DURATION,
  TREASURE_SIZE
} from "./config";
import { assetCatalog, monsterSpriteAnimationIds, trailTileAssetNames, treasureSpriteAnimationIds } from "./asset-catalog";
import { dropTable, monsterTable } from "./game-data";
import trailTileCollisionCsv from "./data/trail-tile-collision-metadata.csv?raw";

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function assetUrl(path: string): string {
  return new URL(`../assets/${path}`, import.meta.url).toString();
}

function spriteSheetUrl(path: string): string {
  return new URL(`../spritesheets/${path}`, import.meta.url).toString();
}

function buildImageSourceMap(entries: typeof assetCatalog): Record<string, ImageSource> {
  return Object.fromEntries(
    entries.map((entry) => [
      entry.assetName,
      new ImageSource(entry.sourceKind === "asset" ? assetUrl(entry.path) : spriteSheetUrl(entry.path))
    ])
  );
}

const imageSources = buildImageSourceMap(assetCatalog);
const char0 = imageSources.char0;
const char1 = imageSources.char1;
const heart0 = imageSources.heart0;
const heart1 = imageSources.heart1;
const treasureSpriteSources = Object.fromEntries(
  treasureSpriteAnimationIds.map((spriteAnimationId) => [spriteAnimationId, imageSources[spriteAnimationId]])
) as Record<string, ImageSource>;

const monsterSpriteSources = Object.fromEntries(
  monsterSpriteAnimationIds.map((spriteAnimationId) => [spriteAnimationId, imageSources[spriteAnimationId]])
) as Record<string, ImageSource>;

const trailTileSources = assetCatalog
  .filter((entry) => entry.category === "trailTile" && trailTileAssetNames.includes(entry.assetName))
  .map((entry) => {
    const source = imageSources[entry.assetName];

    if (!source) {
      throw new Error(`Missing trail tile sprite source for configured asset ${entry.assetName}.`);
    }

    return {
      assetName: entry.assetName,
      source,
      spriteSheetRows: entry.spriteSheetRows ?? 4
    };
  });
// Match the top-bar HUD sizing in DemoScene so heart sprites render at the same size as their screen-space actors.
const HUD_HEIGHT = clamp(GAME_HEIGHT * HUD_HEIGHT_RATIO, HUD_HEIGHT_MIN, HUD_HEIGHT_MAX);
const HEART_HUD_SIZE = clamp(
  HUD_HEIGHT * HEART_SCALE_FACTOR,
  HEART_SIZE_MIN,
  HEART_SIZE_MAX
);

function createGridAnimation(image: ImageSource, displaySize: number, orientationRow = 0, frameDuration = 140, orientationCount = 4): AnimationGraphic {
  const spriteSize = Math.max(1, Math.floor(image.height / orientationCount));
  const frameCount = Math.max(1, Math.floor(image.width / spriteSize));
  const normalizedRow = Math.max(0, Math.min(orientationRow, orientationCount - 1));
  const spriteSheet = SpriteSheet.fromImageSource({
    image,
    grid: {
      rows: orientationCount,
      columns: frameCount,
      spriteWidth: spriteSize,
      spriteHeight: spriteSize
    }
  });

  return new Animation({
    frames: Array.from({ length: frameCount }, (_, frameIndex) => ({
      graphic: (() => {
        const sprite = spriteSheet.getSprite(frameIndex, normalizedRow);
        sprite.width = displaySize;
        sprite.height = displaySize;
        return sprite;
      })(),
      duration: frameDuration
    })),
    strategy: AnimationStrategy.Loop
  });
}

function createSingleSprite(image: ImageSource, displaySize: number): Graphic {
  return Sprite.from(image, {
    destSize: { width: displaySize, height: displaySize }
  });
}

function createTintedSingleSprite(image: ImageSource, displaySize: number, tint: Color): Graphic {
  return Sprite.from(image, {
    destSize: { width: displaySize, height: displaySize },
    tint
  });
}

function createCharacterOrientationGraphics(image: ImageSource, displaySize: number, tint?: Color): Graphic[] {
  const spriteHeight = Math.max(1, Math.floor(image.height / 4));
  const spriteSheet = SpriteSheet.fromImageSource({
    image,
    grid: {
      rows: 4,
      columns: 1,
      spriteWidth: image.width,
      spriteHeight
    }
  });

  return [0, 1, 2, 3].map((rowIndex) => {
    const sprite = spriteSheet.getSprite(0, rowIndex).clone();
    sprite.width = displaySize;
    sprite.height = displaySize;

    if (tint) {
      sprite.tint = tint;
    }

    return sprite;
  });
}

function createHorizontalStripAnimation(image: ImageSource, displaySize: number, frameCount: number, frameDuration = 120): AnimationGraphic {
  const spriteWidth = Math.max(1, Math.floor(image.width / frameCount));
  const spriteHeight = Math.max(1, image.height);
  const spriteSheet = SpriteSheet.fromImageSource({
    image,
    grid: {
      rows: 1,
      columns: frameCount,
      spriteWidth,
      spriteHeight
    }
  });

  return new Animation({
    frames: Array.from({ length: frameCount }, (_, frameIndex) => {
      const sprite = spriteSheet.getSprite(frameIndex, 0);
      sprite.width = displaySize;
      sprite.height = displaySize;
      return {
        graphic: sprite,
        duration: frameDuration
      };
    }),
    strategy: AnimationStrategy.Loop
  });
}

export interface GameSprites {
  playerNormalByOrientation: Graphic[];
  playerSelectedByOrientation: Graphic[];
  heartActive: AnimationGraphic;
  heartInactive: Graphic;
  monsters: MonsterVariant[];
  treasure: AnimationGraphic;
  treasureAnimationsById: Record<string, AnimationGraphic>;
  trailTiles: TrailTileVariant[];
  backdrop: AnimationGraphic;
}

export type TrailTileOrientation = 0 | 1 | 2 | 3;

export interface TrailTileWalls {
  northWall: boolean;
  eastWall: boolean;
  southWall: boolean;
  westWall: boolean;
}

interface TrailTileCollisionRow extends TrailTileWalls {
  assetName: string;
  orientation: TrailTileOrientation;
}

export interface TrailTileVariant {
  assetName: string;
  orientations: AnimationGraphic[];
  collisionByOrientation: TrailTileWalls[];
}

export interface MonsterVariant {
  assetName: string;
  graphic: Graphic;
}

function parseBooleanCell(value: string): boolean {
  const normalizedValue = value.trim().toLowerCase();

  if (normalizedValue === "true") {
    return true;
  }

  if (normalizedValue === "false") {
    return false;
  }

  throw new Error(`Expected a boolean CSV value but received "${value}".`);
}

function parseTrailTileCollisionCsv(csvText: string): TrailTileCollisionRow[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    throw new Error("Trail tile collision metadata CSV is empty.");
  }

  const [headerLine, ...dataLines] = lines;
  const header = headerLine.split(",").map((cell) => cell.trim());
  const expectedHeader = ["assetName", "orientation", "northWall", "eastWall", "southWall", "westWall"];

  if (header.length !== expectedHeader.length || expectedHeader.some((cell, index) => header[index] !== cell)) {
    throw new Error("Trail tile collision metadata CSV has an unexpected header.");
  }

  return dataLines.map((line) => {
    const cells = line.split(",").map((cell) => cell.trim());

    if (cells.length !== expectedHeader.length) {
      throw new Error(`Trail tile collision metadata CSV row has ${cells.length} columns, expected ${expectedHeader.length}.`);
    }

    const orientation = Number.parseInt(cells[1], 10);

    if (!Number.isInteger(orientation) || orientation < 0 || orientation > 3) {
      throw new Error(`Trail tile collision metadata CSV contains an invalid orientation value: ${cells[1]}.`);
    }

    return {
      assetName: cells[0],
      orientation: orientation as TrailTileOrientation,
      northWall: parseBooleanCell(cells[2]),
      eastWall: parseBooleanCell(cells[3]),
      southWall: parseBooleanCell(cells[4]),
      westWall: parseBooleanCell(cells[5])
    };
  });
}

function buildTrailTileCollisionLookup(rows: TrailTileCollisionRow[]): Map<string, TrailTileWalls[]> {
  const lookup = new Map<string, Array<TrailTileWalls | undefined>>();

  for (const row of rows) {
    const existingRows = lookup.get(row.assetName) ?? [undefined, undefined, undefined, undefined];

    if (existingRows[row.orientation]) {
      throw new Error(`Duplicate trail tile collision metadata row for ${row.assetName} orientation ${row.orientation}.`);
    }

    existingRows[row.orientation] = {
      northWall: row.northWall,
      eastWall: row.eastWall,
      southWall: row.southWall,
      westWall: row.westWall
    };

    lookup.set(row.assetName, existingRows);
  }

  const resolvedLookup = new Map<string, TrailTileWalls[]>();

  for (const [assetName, rowsByOrientation] of lookup.entries()) {
    if (rowsByOrientation.some((row) => row === undefined)) {
      throw new Error(`Trail tile collision metadata CSV is missing one or more orientations for ${assetName}.`);
    }

    resolvedLookup.set(assetName, rowsByOrientation as TrailTileWalls[]);
  }

  return resolvedLookup;
}

function getTrailTileCollisionByAsset(assetName: string): TrailTileWalls[] {
  const collisions = trailTileCollisionLookup.get(assetName);

  if (!collisions) {
    throw new Error(`Missing trail tile collision metadata for ${assetName}.`);
  }

  return collisions;
}

const trailTileCollisionLookup = buildTrailTileCollisionLookup(parseTrailTileCollisionCsv(trailTileCollisionCsv));

export const gameAssetSources = imageSources;

export async function loadGameAssets(): Promise<void> {
  await Promise.all(Object.values(gameAssetSources).map((asset) => asset.load()));
}

export function createGameSprites(): GameSprites {
  const monsterVariants = monsterTable.map((monsterRow) => {
    const source = monsterSpriteSources[monsterRow.spriteAnimationId];

    if (!source) {
      throw new Error(`Missing monster sprite source for animation id ${monsterRow.spriteAnimationId}.`);
    }

    return {
      assetName: monsterRow.monsterId,
      graphic: createSingleSprite(source, CHAR_SIZE)
    };
  });

  const treasureAnimationsById = Object.fromEntries(
    dropTable.map((dropRow) => {
      const source = treasureSpriteSources[dropRow.spriteAnimationId];

      if (!source) {
        throw new Error(`Missing treasure sprite source for animation id ${dropRow.spriteAnimationId}.`);
      }

      return [dropRow.dropId, createHorizontalStripAnimation(source, TREASURE_SIZE, TREASURE_ANIMATION_FRAME_COUNT, TREASURE_ANIMATION_FRAME_DURATION)];
    })
  );

  return {
    playerNormalByOrientation: createCharacterOrientationGraphics(char0, CHAR_SIZE),
    playerSelectedByOrientation: createCharacterOrientationGraphics(char0, CHAR_SIZE, Color.fromHex("#4aa3ff")),
    heartActive: createHorizontalStripAnimation(heart0, HEART_HUD_SIZE, HEART_FRAME_COUNT, HEART_ANIMATION_FRAME_DURATION),
    heartInactive: createSingleSprite(heart1, HEART_HUD_SIZE),
    monsters: monsterVariants,
    treasure: treasureAnimationsById.treasure0 ?? createHorizontalStripAnimation(imageSources.treasure0, TREASURE_SIZE, TREASURE_ANIMATION_FRAME_COUNT, TREASURE_ANIMATION_FRAME_DURATION),
    treasureAnimationsById,
    trailTiles: trailTileSources.map(({ assetName, source, spriteSheetRows }) => ({
      assetName,
      orientations: [0, 1, 2, 3].map((orientationRow) => createGridAnimation(source, TILE_SIZE, orientationRow, 140, spriteSheetRows)),
      collisionByOrientation: getTrailTileCollisionByAsset(assetName)
    })),
    backdrop: createGridAnimation(imageSources.chamber4, TILE_SIZE, 0, 180)
  };
}
