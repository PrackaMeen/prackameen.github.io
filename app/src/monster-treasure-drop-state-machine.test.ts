import { describe, expect, it } from "vitest";
import { MonsterTreasureDropStateMachine } from "./monster-treasure-drop-state-machine";

describe("MonsterTreasureDropStateMachine", () => {
  it("resolves mapped treasure drops by monster index", () => {
    const machine = new MonsterTreasureDropStateMachine();

    expect(machine.resolveTreasureDrop(0)).toEqual({
      treasureKey: "coin",
      displayName: "Coin",
      symbol: "C",
      colorHex: "#ffd166"
    });

    expect(machine.resolveTreasureDrop(3)).toEqual({
      treasureKey: "charm",
      displayName: "Charm",
      symbol: "H",
      colorHex: "#f59ae4"
    });
  });

  it("falls back to the default treasure drop for unmapped monsters", () => {
    const machine = new MonsterTreasureDropStateMachine();

    expect(machine.resolveTreasureDrop(999)).toEqual({
      treasureKey: "treasure",
      displayName: "Treasure",
      symbol: "T",
      colorHex: "#ffd166"
    });
  });
});