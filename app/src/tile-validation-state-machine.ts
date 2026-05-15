import type { TrailTileOrientation, TrailTileWalls } from "./game-assets";
import { TILE_SIZE } from "./config";

export interface TilePosition {
  x: number;
  y: number;
}

export interface MoveWallKeys {
  fromWall: TileWallKey;
  toWall: TileWallKey;
}

export type TileWallKey = keyof TrailTileWalls;

export interface DirectMoveValidationResult {
  kind: "invalid" | "allowed" | "blocked";
  wallKeys: MoveWallKeys | null;
}

export interface DiscoveryValidationResult {
  kind: "invalid" | "allowed" | "blocked";
  wallKeys: MoveWallKeys | null;
  allowedOrientations: TrailTileOrientation[];
}

interface DiscoveryState {
  allowedOrientations: TrailTileOrientation[];
}

export class TileValidationStateMachine {
  private discoveryState: DiscoveryState = { allowedOrientations: [] };

  public reset(): void {
    this.discoveryState = { allowedOrientations: [] };
  }

  public getMoveWallKeys(from: TilePosition, to: TilePosition): MoveWallKeys | null {
    const deltaX = to.x - from.x;
    const deltaY = to.y - from.y;

    if (Math.abs(deltaX) + Math.abs(deltaY) !== TILE_SIZE) {
      return null;
    }

    if (deltaX === TILE_SIZE && deltaY === 0) {
      return { fromWall: "eastWall", toWall: "westWall" };
    }

    if (deltaX === -TILE_SIZE && deltaY === 0) {
      return { fromWall: "westWall", toWall: "eastWall" };
    }

    if (deltaX === 0 && deltaY === TILE_SIZE) {
      return { fromWall: "southWall", toWall: "northWall" };
    }

    if (deltaX === 0 && deltaY === -TILE_SIZE) {
      return { fromWall: "northWall", toWall: "southWall" };
    }

    return null;
  }

  public validateDirectMove(
    from: TilePosition,
    to: TilePosition,
    fromWalls: TrailTileWalls | null,
    toWalls: TrailTileWalls | null
  ): DirectMoveValidationResult {
    const wallKeys = this.getMoveWallKeys(from, to);

    if (!wallKeys || !fromWalls || !toWalls) {
      return { kind: "invalid", wallKeys };
    }

    if (this.canTraverseBetweenWalls(fromWalls, toWalls, wallKeys)) {
      return { kind: "allowed", wallKeys };
    }

    return { kind: "blocked", wallKeys };
  }

  public beginDiscovery(
    from: TilePosition,
    to: TilePosition,
    sourceWalls: TrailTileWalls | null,
    candidateWallsByOrientation: TrailTileWalls[]
  ): DiscoveryValidationResult {
    const wallKeys = this.getMoveWallKeys(from, to);

    if (!wallKeys || !sourceWalls) {
      this.discoveryState = { allowedOrientations: [] };
      return { kind: "invalid", wallKeys, allowedOrientations: [] };
    }

    const allowedOrientations = [0, 1, 2, 3].filter((orientation) => {
      const candidateWalls = candidateWallsByOrientation[orientation];
      if (!candidateWalls) {
        return false;
      }

      return this.canTraverseBetweenWalls(sourceWalls, candidateWalls, wallKeys);
    }) as TrailTileOrientation[];

    this.discoveryState = { allowedOrientations };

    return {
      kind: allowedOrientations.length > 0 ? "allowed" : "blocked",
      wallKeys,
      allowedOrientations
    };
  }

  public getAllowedDiscoveryOrientations(): TrailTileOrientation[] {
    return [...this.discoveryState.allowedOrientations];
  }

  public isDiscoveryOrientationAllowed(orientation: TrailTileOrientation): boolean {
    return this.discoveryState.allowedOrientations.includes(orientation);
  }

  public cycleDiscoveryOrientation(current: TrailTileOrientation, step: 1 | -1): TrailTileOrientation {
    const allowedOrientations = this.discoveryState.allowedOrientations;

    if (allowedOrientations.length === 0) {
      return current;
    }

    const currentIndex = allowedOrientations.indexOf(current);
    const normalizedIndex = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex = (normalizedIndex + step + allowedOrientations.length) % allowedOrientations.length;

    return allowedOrientations[nextIndex];
  }

  public canTraverseBetweenWalls(
    fromWalls: TrailTileWalls,
    toWalls: TrailTileWalls,
    wallKeys: MoveWallKeys
  ): boolean {
    return !fromWalls[wallKeys.fromWall] && !toWalls[wallKeys.toWall];
  }
}
