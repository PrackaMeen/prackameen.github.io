import { describe, expect, it } from "vitest";
import { heroRoster } from "./hero-roster";
import { resolveKarakCombat } from "./karak-combat";
import { SeededRandom } from "./seeded-rng";

function createStubRandom(rolls: number[]): SeededRandom {
  let index = 0;
  return {
    rollDie: () => {
      const roll = rolls[index];
      index += 1;
      return roll;
    }
  } as unknown as SeededRandom;
}

describe("karak combat", () => {
  it("gives the seer the first-move combat bonus", () => {
    const seer = heroRoster.find((hero) => hero.id === "seer");
    expect(seer).toBeDefined();

    const combat = resolveKarakCombat(seer!, 7, createStubRandom([3, 3]), 0);

    expect(combat.heroTotal).toBe(8);
    expect(combat.victory).toBe(true);
    expect(combat.tie).toBe(false);
  });

  it("lets the thief win ties", () => {
    const thief = heroRoster.find((hero) => hero.id === "thief");
    expect(thief).toBeDefined();

    const combat = resolveKarakCombat(thief!, 7, createStubRandom([3, 4]), 2);

    expect(combat.heroTotal).toBe(7);
    expect(combat.tie).toBe(true);
    expect(combat.victory).toBe(true);
  });

  it("rerolls both dice for the warrior after a losing roll", () => {
    const warrior = heroRoster.find((hero) => hero.id === "warrior");
    expect(warrior).toBeDefined();

    const combat = resolveKarakCombat(warrior!, 7, createStubRandom([1, 1, 5, 4]), 1);

    expect(combat.heroTotal).toBe(9);
    expect(combat.victory).toBe(true);
  });
});
