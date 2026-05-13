const fallbackWidth = 1280;
const fallbackHeight = 720;

const viewportWidth = typeof window !== "undefined" ? window.innerWidth : fallbackWidth;
const viewportHeight = typeof window !== "undefined" ? window.innerHeight : fallbackHeight;

export const GAME_WIDTH = viewportWidth;
export const GAME_HEIGHT = viewportHeight;
export const GAME_TITLE = "PrackaMeen Arcade Lab";
export const TILE_SIZE = 128;
export const CHAR_SIZE = 64;

export const gameSettings = {
	cameraZoomMin: 0.5,
	cameraZoomMax: 2,
	cameraZoomLevels: [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2],
	cameraZoomDragThreshold: 18
};
