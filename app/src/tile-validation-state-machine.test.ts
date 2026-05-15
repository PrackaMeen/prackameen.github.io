import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TILE_SIZE } from "./config";
import { TileValidationStateMachine, type TilePosition } from "./tile-validation-state-machine";
import type { TrailTileOrientation, TrailTileWalls } from "./game-assets";

interface CollisionCsvRow {
  assetName: string;
  orientation: TrailTileOrientation;
  walls: TrailTileWalls;
}

interface DirectionCase {
  fromWall: keyof TrailTileWalls;
  toWall: keyof TrailTileWalls;
  toPosition: TilePosition;
}

const directions: DirectionCase[] = [
  { fromWall: "eastWall", toWall: "westWall", toPosition: { x: TILE_SIZE, y: 0 } },
  { fromWall: "westWall", toWall: "eastWall", toPosition: { x: -TILE_SIZE, y: 0 } },
  { fromWall: "southWall", toWall: "northWall", toPosition: { x: 0, y: TILE_SIZE } },
  { fromWall: "northWall", toWall: "southWall", toPosition: { x: 0, y: -TILE_SIZE } }
];

function parseCollisionCsv(csvText: string): CollisionCsvRow[] {
  const [headerLine, ...dataLines] = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const header = headerLine.split(",");
  const expectedHeader = ["assetName", "orientation", "northWall", "eastWall", "southWall", "westWall"];

  expect(header).toEqual(expectedHeader);

  return dataLines.map((line) => {
    const [assetName, orientationText, northText, eastText, southText, westText] = line.split(",");

    return {
      assetName,
      orientation: Number.parseInt(orientationText, 10) as TrailTileOrientation,
      walls: {
        northWall: northText === "true",
        eastWall: eastText === "true",
        southWall: southText === "true",
        westWall: westText === "true"
      }
    };
  });
}

function groupRowsByAsset(rows: CollisionCsvRow[]): Map<string, TrailTileWalls[]> {
  const groupedRows = new Map<string, TrailTileWalls[]>();

  for (const row of rows) {
    const assetRows = groupedRows.get(row.assetName) ?? [undefined, undefined, undefined, undefined];
    assetRows[row.orientation] = row.walls;
    groupedRows.set(row.assetName, assetRows as TrailTileWalls[]);
  }

  return groupedRows;
}

function emptyWalls(): TrailTileWalls {
  return {
    northWall: false,
    eastWall: false,
    southWall: false,
    westWall: false
  };
}

const csvText = readFileSync(new URL("./data/trail-tile-collision-metadata.csv", import.meta.url), "utf8");
const collisionRows = parseCollisionCsv(csvText);
const collisionRowsByAsset = groupRowsByAsset(collisionRows);

function createMachine(): TileValidationStateMachine {
  return new TileValidationStateMachine();
}

describe("TileValidationStateMachine", () => {
  it("rejects diagonal and non-adjacent moves", () => {
    const machine = createMachine();
    const sourceWalls = collisionRows[0].walls;
    const targetWalls = collisionRows[1].walls;

    const diagonalResult = machine.validateDirectMove(
      { x: 0, y: 0 },
      { x: TILE_SIZE, y: TILE_SIZE },
      sourceWalls,
      targetWalls
    );

    const distantResult = machine.validateDirectMove(
      { x: 0, y: 0 },
      { x: TILE_SIZE * 2, y: 0 },
      sourceWalls,
      targetWalls
    );

    expect(diagonalResult.kind).toBe("invalid");
    expect(diagonalResult.wallKeys).toBeNull();
    expect(distantResult.kind).toBe("invalid");
    expect(distantResult.wallKeys).toBeNull();
  });

  it("validates direct movement for every catalog wall combination", () => {
    const machine = createMachine();

    for (const sourceRow of collisionRows) {
      for (const targetRow of collisionRows) {
        for (const direction of directions) {
          const result = machine.validateDirectMove(
            { x: 0, y: 0 },
            direction.toPosition,
            sourceRow.walls,
            targetRow.walls
          );
          const expectedAllowed = !sourceRow.walls[direction.fromWall] && !targetRow.walls[direction.toWall];

          expect(result.wallKeys).toEqual({ fromWall: direction.fromWall, toWall: direction.toWall });
          expect(result.kind).toBe(expectedAllowed ? "allowed" : "blocked");
        }
      }
    }
  });

  it("computes allowed discovery orientations for every catalog source and target asset", () => {
    const machine = createMachine();

    for (const sourceRow of collisionRows) {
      for (const [assetName, candidateWallsByOrientation] of collisionRowsByAsset.entries()) {
        for (const direction of directions) {
          const result = machine.beginDiscovery(
            { x: 0, y: 0 },
            direction.toPosition,
            sourceRow.walls,
            candidateWallsByOrientation
          );
          const expectedOrientations = [0, 1, 2, 3].filter((orientation) => {
            const candidateWalls = candidateWallsByOrientation[orientation];

            return Boolean(candidateWalls) && !sourceRow.walls[direction.fromWall] && !candidateWalls[direction.toWall];
          }) as TrailTileOrientation[];

          expect(result.wallKeys).toEqual({ fromWall: direction.fromWall, toWall: direction.toWall });
          expect(result.allowedOrientations).toEqual(expectedOrientations);
          expect(machine.getAllowedDiscoveryOrientations()).toEqual(expectedOrientations);
          expect(result.kind).toBe(expectedOrientations.length > 0 ? "allowed" : "blocked");
        }
      }
    }
  });

  it("cycles only through allowed discovery orientations", () => {
    const machine = createMachine();
    const sourceWalls = emptyWalls();
    const candidateWallsByOrientation = [
      emptyWalls(),
      { northWall: true, eastWall: true, southWall: true, westWall: true },
      emptyWalls(),
      { northWall: true, eastWall: true, southWall: true, westWall: true }
    ];

    const discoveryResult = machine.beginDiscovery(
      { x: 0, y: 0 },
      { x: TILE_SIZE, y: 0 },
      sourceWalls,
      candidateWallsByOrientation
    );

    expect(discoveryResult.allowedOrientations).toEqual([0, 2]);
    expect(machine.cycleDiscoveryOrientation(0, 1)).toBe(2);
    expect(machine.cycleDiscoveryOrientation(2, 1)).toBe(0);
    expect(machine.cycleDiscoveryOrientation(0, -1)).toBe(2);
    expect(machine.cycleDiscoveryOrientation(2, -1)).toBe(0);
    expect(machine.isDiscoveryOrientationAllowed(0)).toBe(true);
    expect(machine.isDiscoveryOrientationAllowed(1)).toBe(false);
  });

  it("resets discovery orientation state", () => {
    const machine = createMachine();

    machine.beginDiscovery(
      { x: 0, y: 0 },
      { x: TILE_SIZE, y: 0 },
      emptyWalls(),
      [emptyWalls(), emptyWalls(), emptyWalls(), emptyWalls()]
    );

    expect(machine.getAllowedDiscoveryOrientations().length).toBe(4);

    machine.reset();

    expect(machine.getAllowedDiscoveryOrientations()).toEqual([]);
    expect(machine.isDiscoveryOrientationAllowed(0)).toBe(false);
    expect(machine.cycleDiscoveryOrientation(0, 1)).toBe(0);
  });
});
