import { Animation, AnimationStrategy, ImageSource, SpriteSheet, type Animation as AnimationGraphic, type Graphic, type Sprite } from "excalibur";
import { CHAR_SIZE, GAME_HEIGHT, GAME_WIDTH, TILE_SIZE } from "./config";

function assetUrl(path: string): string {
  return new URL(`../assets/${path}`, import.meta.url).toString();
}

const char0 = new ImageSource(assetUrl("chars/Char0_2.png"));
const char1 = new ImageSource(assetUrl("chars/Char1_2.png"));
const road0 = new ImageSource(assetUrl("tiles/Road0_0.png"));
const road1 = new ImageSource(assetUrl("tiles/Road0_1.png"));
const road2 = new ImageSource(assetUrl("tiles/Road0_2.png"));
const road3 = new ImageSource(assetUrl("tiles/Road0_3.png"));
const road4 = new ImageSource(assetUrl("tiles/Road4_0.png"));
const chamber = new ImageSource(assetUrl("tiles/Chamber4_0.png"));

function createStripAnimation(image: ImageSource, displaySize: number, frameDuration = 140): AnimationGraphic {
  const spriteWidth = Math.max(1, Math.floor(image.width / 4));
  const spriteHeight = Math.max(1, image.height);
  const spriteSheet = SpriteSheet.fromImageSource({
    image,
    grid: {
      rows: 1,
      columns: 4,
      spriteWidth,
      spriteHeight
    }
  });

  return new Animation({
    frames: [0, 1, 2, 3].map((frameIndex) => ({
      graphic: (() => {
        const sprite = spriteSheet.getSprite(frameIndex, 0);
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
  chamber
};

export async function loadGameAssets(): Promise<void> {
  await Promise.all(Object.values(gameAssetSources).map((asset) => asset.load()));
}

export function createGameSprites(): GameSprites {
  return {
    playerNormal: createSingleSprite(char1, CHAR_SIZE),
    playerSelected: createSingleSprite(char0, CHAR_SIZE),
    trailTiles: [road0, road1, road2, road3, road4].map((asset) => createStripAnimation(asset, TILE_SIZE)),
    backdrop: createStripAnimation(chamber, TILE_SIZE, 180)
  };
}