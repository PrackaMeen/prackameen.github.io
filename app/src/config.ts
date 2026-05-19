const fallbackWidth = 1280;
const fallbackHeight = 720;

const viewportWidth = typeof window !== "undefined" ? window.innerWidth : fallbackWidth;
const viewportHeight = typeof window !== "undefined" ? window.innerHeight : fallbackHeight;

export const GAME_WIDTH = viewportWidth;
export const GAME_HEIGHT = viewportHeight;
export const GAME_TITLE = "PrackaMeen Arcade Lab";
export const TILE_SIZE = 128;
export const CHAR_SIZE = 128;
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

export type TrailTileVersion = "v1" | "v2";

const trailTileVersionStorageKey = "trailTileVersion";

function readTrailTileVersion(): TrailTileVersion {
	if (typeof window === "undefined") {
		return "v1";
	}

	const searchParams = new URLSearchParams(window.location.search);
	const requestedVersion = searchParams.get("tileVersion") ?? searchParams.get("tiles") ?? searchParams.get("tileSet");
	const storedVersion = globalThis.localStorage?.getItem(trailTileVersionStorageKey);

	if (requestedVersion === "v2") {
		return "v2";
	}

	if (storedVersion === "v2") {
		return "v2";
	}

	return "v1";
}

	export function getTrailTileVersion(): TrailTileVersion {
	return readTrailTileVersion();
}

	export const TRAIL_TILE_VERSION = getTrailTileVersion();

export function setTrailTileVersionPreference(version: TrailTileVersion): void {
	globalThis.localStorage?.setItem(trailTileVersionStorageKey, version);
}

export const USED_TRAIL_TILE_ASSET_NAMES = [
	"road0",
	"road1",
	"road2",
	"road3",
	"road4",
	"fountain4",
	"chamber0",
	"chamber1",
	"chamber2",
	"chamber3",
	"chamber4"
] as const;

export const gameSettings = {
	cameraZoomMin: 0.25,
	cameraZoomMax: 4,
	cameraZoomLevels: [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 4],
	cameraZoomDragThreshold: 18,
	debugInfoEnabled: true
};
