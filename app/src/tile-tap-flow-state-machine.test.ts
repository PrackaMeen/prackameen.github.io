import { describe, expect, it } from "vitest";
import { TileTapFlowStateMachine } from "./tile-tap-flow-state-machine";

function createMachine(): TileTapFlowStateMachine {
  return new TileTapFlowStateMachine();
}

describe("TileTapFlowStateMachine", () => {
  it("routes chamber monster tiles into the fight flow before move flow", () => {
    const machine = createMachine();

    const decision = machine.resolveSelectedTap({
      currentPosition: { x: 32, y: 32 },
      targetPosition: { x: 64, y: 32 },
      isAdjacent: true,
      canMoveBetweenPositions: true,
      currentHasPlacedTrailTile: true,
      targetHasPlacedTrailTile: true,
      hasChamberMonster: true
    });

    expect(decision).toEqual({ kind: "fightChamber", targetPosition: { x: 64, y: 32 } });
  });

  it("routes placed trail tiles into the direct move flow when no monster is present", () => {
    const machine = createMachine();

    const decision = machine.resolveSelectedTap({
      currentPosition: { x: 32, y: 32 },
      targetPosition: { x: 64, y: 32 },
      isAdjacent: true,
      canMoveBetweenPositions: true,
      currentHasPlacedTrailTile: true,
      targetHasPlacedTrailTile: true,
      hasChamberMonster: false
    });

    expect(decision).toEqual({ kind: "moveToPlacedTile", targetPosition: { x: 64, y: 32 } });
  });

  it("routes empty adjacent tiles into the discovery flow", () => {
    const machine = createMachine();

    const decision = machine.resolveSelectedTap({
      currentPosition: { x: 32, y: 32 },
      targetPosition: { x: 64, y: 32 },
      isAdjacent: true,
      canMoveBetweenPositions: true,
      currentHasPlacedTrailTile: true,
      targetHasPlacedTrailTile: false,
      hasChamberMonster: false
    });

    expect(decision).toEqual({ kind: "discoverTile", targetPosition: { x: 64, y: 32 } });
  });

  it("ignores empty adjacent tiles when the character is not on a placed tile", () => {
    const machine = createMachine();

    const decision = machine.resolveSelectedTap({
      currentPosition: { x: 32, y: 32 },
      targetPosition: { x: 64, y: 32 },
      isAdjacent: true,
      canMoveBetweenPositions: true,
      currentHasPlacedTrailTile: false,
      targetHasPlacedTrailTile: false,
      hasChamberMonster: false
    });

    expect(decision).toEqual({ kind: "ignore" });
  });

  it("ignores taps that cannot move between positions", () => {
    const machine = createMachine();

    const decision = machine.resolveSelectedTap({
      currentPosition: { x: 32, y: 32 },
      targetPosition: { x: 96, y: 32 },
      isAdjacent: false,
      canMoveBetweenPositions: false,
      currentHasPlacedTrailTile: true,
      targetHasPlacedTrailTile: false,
      hasChamberMonster: false
    });

    expect(decision).toEqual({ kind: "ignore" });
  });
});