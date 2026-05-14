import { Animation, AnimationStrategy, ImageSource, SpriteSheet, type Animation as AnimationGraphic, type Graphic } from "excalibur";
import { CHAR_SIZE, GAME_HEIGHT, GAME_WIDTH, TILE_SIZE } from "./config";

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
  trailTiles: AnimationGraphic[];
  backdrop: AnimationGraphic;
}

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
};

export async function loadGameAssets(): Promise<void> {
  await Promise.all(Object.values(gameAssetSources).map((asset) => asset.load()));
}

export function createGameSprites(): GameSprites {
  return {
    playerNormal: createSingleSprite(char1, CHAR_SIZE),
    playerSelected: createSingleSprite(char0, CHAR_SIZE),
    trailTiles: [
      road0,
      road1,
      road2,
      road3,
      road4,
      chamber0,
      chamber1,
      chamber2,
      chamber3,
      chamber4
    ].map((asset) => createGridAnimation(asset, TILE_SIZE)),
    backdrop: createGridAnimation(chamber4, TILE_SIZE, 0, 180)
  };
}