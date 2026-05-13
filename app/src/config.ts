const fallbackWidth = 1280;
const fallbackHeight = 720;

const viewportWidth = typeof window !== "undefined" ? window.innerWidth : fallbackWidth;
const viewportHeight = typeof window !== "undefined" ? window.innerHeight : fallbackHeight;

export const GAME_WIDTH = viewportWidth;
export const GAME_HEIGHT = viewportHeight;
export const GAME_TITLE = "PrackaMeen Arcade Lab";
export const TILE_SIZE = 128;
export const CHAR_SIZE = 64;
export const CAMERA_ZOOM_MIN = 0.6;
export const CAMERA_ZOOM_MAX = 2.5;
