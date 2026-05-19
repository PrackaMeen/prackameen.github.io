import { describe, expect, it } from "vitest";
import { SeededRandom } from "./seeded-rng";

describe("seeded random", () => {
  it("produces the same dice sequence for the same seed", () => {
    const first = new SeededRandom("karak-seed");
    const second = new SeededRandom("karak-seed");

    const firstRolls = [first.rollDie(), first.rollDie(), first.rollDie(), first.rollDie()];
    const secondRolls = [second.rollDie(), second.rollDie(), second.rollDie(), second.rollDie()];

    expect(firstRolls).toEqual(secondRolls);
    expect(firstRolls.every((roll) => roll >= 1 && roll <= 6)).toBe(true);
  });

  it("changes the sequence when the seed changes", () => {
    const first = new SeededRandom("karak-seed-a");
    const second = new SeededRandom("karak-seed-b");

    expect([first.rollDie(), first.rollDie(), first.rollDie()]).not.toEqual([second.rollDie(), second.rollDie(), second.rollDie()]);
  });
});
