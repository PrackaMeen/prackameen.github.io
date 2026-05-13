import { Animation, AnimationStrategy, ImageSource, SpriteSheet, type Animation as AnimationGraphic } from "excalibur";
import { GAME_HEIGHT, GAME_WIDTH, TILE_SIZE } from "./config";

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

function createStripAnimation(image: ImageSource, frameDuration = 140): AnimationGraphic {
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

  return Animation.fromSpriteSheet(spriteSheet, [0, 1, 2, 3], frameDuration, AnimationStrategy.Loop);
}

export interface GameSprites {
  playerNormal: AnimationGraphic;
  playerSelected: AnimationGraphic;
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
    playerNormal: createStripAnimation(char0),
    playerSelected: createStripAnimation(char1),
    trailTiles: [road0, road1, road2, road3, road4].map((asset) => createStripAnimation(asset)),
    backdrop: createStripAnimation(chamber, 180)
  };
}