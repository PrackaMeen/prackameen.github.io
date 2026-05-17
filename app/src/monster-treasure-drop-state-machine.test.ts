import { describe, expect, it } from "vitest";
import { MonsterTreasureDropStateMachine } from "./monster-treasure-drop-state-machine";

describe("MonsterTreasureDropStateMachine", () => {
  it("resolves mapped treasure drops by monster index", () => {
    const machine = new MonsterTreasureDropStateMachine();

    expect(machine.resolveTreasureDrop(0)).toEqual({
      monsterId: "rat",
      dropId: "coin",
      monsterIndex: 0,
      hp: 1,
      monsterSpriteAnimationId: "monster0",
      dropSpriteAnimationId: "treasure0",
      treasureKey: "coin",
      displayName: "Coin",
      symbol: "C",
      colorHex: "#ffd166"
    });

    expect(machine.resolveTreasureDrop(3)).toEqual({
      monsterId: "slime",
      dropId: "charm",
      monsterIndex: 3,
      hp: 4,
      monsterSpriteAnimationId: "monster3",
      dropSpriteAnimationId: "treasure0",
      treasureKey: "charm",
      displayName: "Charm",
      symbol: "H",
      colorHex: "#f59ae4"
    });
  });

  it("falls back to the default treasure drop for unmapped monsters", () => {
    const machine = new MonsterTreasureDropStateMachine();

    expect(machine.resolveTreasureDrop(999)).toEqual({
      monsterId: "unknown",
      dropId: "treasure",
      monsterIndex: -1,
      hp: 0,
      monsterSpriteAnimationId: "monster0",
      dropSpriteAnimationId: "treasure0",
      treasureKey: "treasure",
      displayName: "Treasure",
      symbol: "T",
      colorHex: "#ffd166"
    });
  });

  it("resolves monster indices from treasure keys using the csv cross table", () => {
    const machine = new MonsterTreasureDropStateMachine();

    expect(machine.resolveMonsterIndexForTreasureKey("coin")).toBe(0);
    expect(machine.resolveMonsterIndexForTreasureKey("crown")).toBe(5);
    expect(machine.resolveMonsterIndexForTreasureKey("missing")).toBe(0);
  });
});