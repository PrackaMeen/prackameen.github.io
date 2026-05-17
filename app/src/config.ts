const fallbackWidth = 1280;
const fallbackHeight = 720;

const viewportWidth = typeof window !== "undefined" ? window.innerWidth : fallbackWidth;
const viewportHeight = typeof window !== "undefined" ? window.innerHeight : fallbackHeight;

export const GAME_WIDTH = viewportWidth;
export const GAME_HEIGHT = viewportHeight;
export const GAME_TITLE = "PrackaMeen Arcade Lab";
export const TILE_SIZE = 128;
export const CHAR_SIZE = 64;
export const TREASURE_SIZE = CHAR_SIZE * 0.5;
export const TREASURE_ANIMATION_FRAME_COUNT = 4;
export const TREASURE_ANIMATION_FRAME_DURATION = 200;
export const HUD_HEIGHT_RATIO = 0.08;
export const HUD_HEIGHT_MIN = 54;
export const HUD_HEIGHT_MAX = 72;
export const HEART_SCALE_FACTOR = 0.38;
export const HEART_SIZE_MIN = 14;
export const HEART_SIZE_MAX = 22;
export const HEART_FRAME_COUNT = 4;
export const HEART_ANIMATION_FRAME_DURATION = 300;

export const gameSettings = {
	cameraZoomMin: 0.5,
	cameraZoomMax: 2,
	cameraZoomLevels: [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2],
	cameraZoomDragThreshold: 18,
	debugInfoEnabled: true
};
