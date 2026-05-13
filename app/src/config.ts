const fallbackWidth = 1280;
const fallbackHeight = 720;

const viewportWidth = typeof window !== "undefined" ? window.innerWidth : fallbackWidth;
const viewportHeight = typeof window !== "undefined" ? window.innerHeight : fallbackHeight;

export const GAME_WIDTH = viewportWidth;
export const GAME_HEIGHT = viewportHeight;
export const GAME_TITLE = "PrackaMeen Arcade Lab";
export const TILE_SIZE = 32;
