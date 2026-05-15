import { Animation, AnimationStrategy, ImageSource, SpriteSheet, type Animation as AnimationGraphic, type Graphic } from "excalibur";
import { CHAR_SIZE, GAME_HEIGHT, GAME_WIDTH, TILE_SIZE } from "./config";
import trailTileCollisionCsv from "./data/trail-tile-collision-metadata.csv?raw";

function assetUrl(path: string): string {
  return new URL(`../assets/${path}`, import.meta.url).toString();
}

function spriteSheetUrl(path: string): string {
  return new URL(`../spritesheets/${path}`, import.meta.url).toString();
}

const char0 = new ImageSource(assetUrl("chars/Char0_2.png"));
const char1 = new ImageSource(assetUrl("chars/Char1_2.png"));
const road0 = new ImageSource(spriteSheetUrl("Road0/Road0.png"));
const road1 = new ImageSource(spriteSheetUrl("Road1/Road1.png"));
const road2 = new ImageSource(spriteSheetUrl("Road2/Road2.png"));
const road3 = new ImageSource(spriteSheetUrl("Road3/Road3.png"));
const road4 = new ImageSource(spriteSheetUrl("Road4/Road4.png"));
const chamber0 = new ImageSource(spriteSheetUrl("Chamber0/Chamber0.png"));
const chamber1 = new ImageSource(spriteSheetUrl("Chamber1/Chamber1.png"));
const chamber2 = new ImageSource(spriteSheetUrl("Chamber2/Chamber2.png"));
const chamber3 = new ImageSource(spriteSheetUrl("Chamber3/Chamber3.png"));
const chamber4 = new ImageSource(spriteSheetUrl("Chamber4/Chamber4.png"));
const monster0 = new ImageSource(spriteSheetUrl("Monster0/Monster0.png"));
const monster1 = new ImageSource(spriteSheetUrl("Monster1/Monster1.png"));
const monster2 = new ImageSource(spriteSheetUrl("Monster2/Monster2.png"));
const monster3 = new ImageSource(spriteSheetUrl("Monster3/Monster3.png"));
const monster4 = new ImageSource(spriteSheetUrl("Monster4/Monster4.png"));
const monster5 = new ImageSource(spriteSheetUrl("Monster5/Monster5.png"));
const hearth0 = new ImageSource(spriteSheetUrl("Hearth0/Hearth0.png"));
const hearth1 = new ImageSource(spriteSheetUrl("Hearth1/Hearth1.png"));

function createGridAnimation(image: ImageSource, displaySize: number, orientationRow = 0, frameDuration = 140): AnimationGraphic {
  const orientationCount = 4;
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
  const sprite = image.toSprite();
  sprite.width = displaySize;
  sprite.height = displaySize;
  return sprite;
}

export interface GameSprites {
  playerNormal: Graphic;
  playerSelected: Graphic;
  heartActive: Graphic;
  heartInactive: Graphic;
  monsters: MonsterVariant[];
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

export const gameAssetSources = {
  char0,
  char1,
  road0,
  road1,
  road2,
  road3,
  road4,
  chamber0,
  chamber1,
  chamber2,
  chamber3,
  chamber4,
  monster0,
  monster1,
  monster2,
  monster3,
  monster4,
  monster5,
  hearth0,
  hearth1,
};

export async function loadGameAssets(): Promise<void> {
  await Promise.all(Object.values(gameAssetSources).map((asset) => asset.load()));
}

export function createGameSprites(): GameSprites {
  const monsterTileSources = [
    { assetName: "monster0", source: monster0 },
    { assetName: "monster1", source: monster1 },
    { assetName: "monster2", source: monster2 },
    { assetName: "monster3", source: monster3 },
    { assetName: "monster4", source: monster4 },
    { assetName: "monster5", source: monster5 }
  ];

  const trailTileSources = [
    { assetName: "road0", source: road0 },
    { assetName: "road1", source: road1 },
    { assetName: "road2", source: road2 },
    { assetName: "road3", source: road3 },
    { assetName: "road4", source: road4 },
    { assetName: "chamber0", source: chamber0 },
    { assetName: "chamber1", source: chamber1 },
    { assetName: "chamber2", source: chamber2 },
    { assetName: "chamber3", source: chamber3 },
    { assetName: "chamber4", source: chamber4 }
  ];

  return {
    playerNormal: createSingleSprite(char1, CHAR_SIZE),
    playerSelected: createSingleSprite(char0, CHAR_SIZE),
    heartActive: createSingleSprite(hearth0, CHAR_SIZE),
    heartInactive: createSingleSprite(hearth1, CHAR_SIZE),
    monsters: monsterTileSources.map(({ assetName, source }) => ({
      assetName,
      graphic: createSingleSprite(source, CHAR_SIZE)
    })),
    trailTiles: trailTileSources.map(({ assetName, source }) => ({
      assetName,
      orientations: [0, 1, 2, 3].map((orientationRow) => createGridAnimation(source, TILE_SIZE, orientationRow)),
      collisionByOrientation: getTrailTileCollisionByAsset(assetName)
    })),
    backdrop: createGridAnimation(chamber4, TILE_SIZE, 0, 180)
  };
}