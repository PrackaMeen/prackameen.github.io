import type { TilePosition } from "./tile-validation-state-machine";

export interface TileTapFlowContext {
  currentPosition: TilePosition;
  targetPosition: TilePosition;
  isAdjacent: boolean;
  canMoveBetweenPositions: boolean;
  currentHasPlacedTrailTile: boolean;
  targetHasPlacedTrailTile: boolean;
  hasChamberMonster: boolean;
}

export interface TileTapFlowDecisionMoveToPlacedTile {
  kind: "moveToPlacedTile";
  targetPosition: TilePosition;
}

export interface TileTapFlowDecisionDiscoverTile {
  kind: "discoverTile";
  targetPosition: TilePosition;
}

export interface TileTapFlowDecisionFightChamber {
  kind: "fightChamber";
  targetPosition: TilePosition;
}

export interface TileTapFlowDecisionIgnore {
  kind: "ignore";
}

export type TileTapFlowDecision =
  | TileTapFlowDecisionMoveToPlacedTile
  | TileTapFlowDecisionDiscoverTile
  | TileTapFlowDecisionFightChamber
  | TileTapFlowDecisionIgnore;

export class TileTapFlowStateMachine {
  public resolveSelectedTap(context: TileTapFlowContext): TileTapFlowDecision {
    if (!context.isAdjacent) {
      return { kind: "ignore" };
    }

    if (context.hasChamberMonster) {
      return { kind: "fightChamber", targetPosition: context.targetPosition };
    }

    if (context.targetHasPlacedTrailTile) {
      if (!context.canMoveBetweenPositions) {
        return { kind: "ignore" };
      }

      return { kind: "moveToPlacedTile", targetPosition: context.targetPosition };
    }

    if (context.currentHasPlacedTrailTile) {
      return { kind: "discoverTile", targetPosition: context.targetPosition };
    }

    return { kind: "ignore" };
  }
}