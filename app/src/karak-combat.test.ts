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

function getHero(heroId: string) {
  const hero = heroRoster.find((entry) => entry.id === heroId);

  expect(hero).toBeDefined();

  return hero!;
}

describe("karak combat", () => {
  it.each([
    {
      name: "regular loss keeps the monster alive",
      heroId: "wizard",
      rolls: [2, 2],
      monsterTotal: 6,
      isFirstStepOfTurn: false,
      expected: { heroTotal: 4, victory: false, tie: false, rolls: [2, 2] }
    },
    {
      name: "seer gets the first-move combat bonus",
      heroId: "seer",
      rolls: [3, 3],
      monsterTotal: 7,
      isFirstStepOfTurn: true,
      expected: { heroTotal: 8, victory: true, tie: false, rolls: [3, 3] }
    },
    {
      name: "seer does not get the bonus after the first step",
      heroId: "seer",
      rolls: [3, 3],
      monsterTotal: 7,
      isFirstStepOfTurn: false,
      expected: { heroTotal: 7, victory: false, tie: true, rolls: [3, 3] }
    },
    {
      name: "thief wins ties",
      heroId: "thief",
      rolls: [3, 4],
      monsterTotal: 7,
      isFirstStepOfTurn: false,
      expected: { heroTotal: 7, victory: true, tie: true, rolls: [3, 4] }
    },
    {
      name: "warrior rerolls both dice after a losing roll",
      heroId: "warrior",
      rolls: [1, 1, 5, 4],
      monsterTotal: 7,
      isFirstStepOfTurn: false,
      expected: { heroTotal: 9, victory: true, tie: false, rolls: [5, 4] }
    },
    {
      name: "swordsman rerolls dice that show one",
      heroId: "swordsman",
      rolls: [1, 4, 5],
      monsterTotal: 8,
      isFirstStepOfTurn: false,
      expected: { heroTotal: 9, victory: true, tie: false, rolls: [5, 4] }
    }
  ])("$name", ({ heroId, rolls, monsterTotal, isFirstStepOfTurn, expected }) => {
    const combat = resolveKarakCombat(getHero(heroId), monsterTotal, createStubRandom(rolls), isFirstStepOfTurn);

    expect(combat.heroTotal).toBe(expected.heroTotal);
    expect(combat.monsterTotal).toBe(monsterTotal);
    expect(combat.victory).toBe(expected.victory);
    expect(combat.tie).toBe(expected.tie);
    expect(combat.rolls).toEqual(expected.rolls);
  });
});
