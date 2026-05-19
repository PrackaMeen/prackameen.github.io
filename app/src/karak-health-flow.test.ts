import { describe, expect, it } from "vitest";
import { applyKarakMonsterDamage, reviveKarakHero } from "./karak-health-flow";

describe("karak health flow", () => {
  it("marks the hero unconscious when the last life is lost", () => {
    const nextState = applyKarakMonsterDamage(1, 5);

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
});
