import { describe, expect, it } from "vitest";
import { getTrailTileVersion, USED_TRAIL_TILE_ASSET_NAMES } from "./config";
import { getTrailTileAssetNames, getTrailTileDefinitions } from "./asset-catalog";

describe("asset catalog", () => {
  it("applies the trail-tile allowlist to the active versioned catalog", () => {
    const usedTrailTileAssetNameSet = new Set<string>(USED_TRAIL_TILE_ASSET_NAMES);
    const trailTileDefinitions = getTrailTileDefinitions();

    expect(getTrailTileAssetNames()).toEqual(USED_TRAIL_TILE_ASSET_NAMES);
    expect(trailTileDefinitions.every((definition) => usedTrailTileAssetNameSet.has(definition.assetName))).toBe(true);
    expect(getTrailTileVersion() === "v1" || getTrailTileVersion() === "v2").toBe(true);
  });

  it("maps chamber4 to the version-specific source asset", () => {
    const chamber4 = getTrailTileDefinitions().find((definition) => definition.assetName === "chamber4");

    expect(chamber4).toBeDefined();
    expect(chamber4?.sourceAssetNames).toEqual(getTrailTileVersion() === "v2" ? ["chamber4-v2"] : ["chamber4"]);
  });
});