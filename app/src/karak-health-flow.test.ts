import { describe, expect, it } from "vitest";
import { applyKarakFountainHeal, applyKarakMonsterDamage, reviveKarakHero } from "./karak-health-flow";

describe("karak health flow", () => {
  it("marks the hero unconscious when the last life is lost", () => {
    const nextState = applyKarakMonsterDamage(1, 5);

    expect(nextState).toEqual({
      health: 0,
      isUnconscious: true,
      revivePending: true
    });
  });

  it("clips damage to zero when the hit is larger than the remaining health", () => {
    const nextState = applyKarakMonsterDamage(2, 5, 9);

    expect(nextState).toEqual({
      health: 0,
      isUnconscious: true,
      revivePending: true
    });
  });

  it("revives the hero back to one life on the next turn", () => {
    const revivedState = reviveKarakHero({
      health: 0,
      isUnconscious: true,
      revivePending: true
    });

    expect(revivedState).toEqual({
      health: 1,
      isUnconscious: false,
      revivePending: false
    });
  });

  it("keeps an already active hero unchanged when revive is not pending", () => {
    const currentState = {
      health: 3,
      isUnconscious: false,
      revivePending: false
    };

    expect(reviveKarakHero(currentState)).toBe(currentState);
  });

  it("fully heals the hero at a fountain and clears revive state", () => {
    const healedState = applyKarakFountainHeal({
      health: 1,
      isUnconscious: true,
      revivePending: true
    }, 5);

    expect(healedState).toEqual({
      health: 5,
      isUnconscious: false,
      revivePending: false
    });
  });

  it("leaves a fully healed hero unchanged at a fountain", () => {
    const currentState = {
      health: 5,
      isUnconscious: false,
      revivePending: false
    };

    expect(applyKarakFountainHeal(currentState, 5)).toBe(currentState);
  });
});
