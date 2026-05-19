import { describe, expect, it } from "vitest";
import { getHeroById, getNextHeroId, getSelectedHeroId, heroRoster, setSelectedHeroPreference } from "./hero-roster";

function createLocalStorageStub(): Storage {
  const entries = new Map<string, string>();

  return {
    get length() {
      return entries.size;
    },
    clear: () => entries.clear(),
    getItem: (key: string) => entries.get(key) ?? null,
    key: (index: number) => Array.from(entries.keys())[index] ?? null,
    removeItem: (key: string) => {
      entries.delete(key);
    },
    setItem: (key: string, value: string) => {
      entries.set(key, value);
    }
  } as Storage;
}

describe("hero roster", () => {
  it("matches the Karak heroes described on the source page", () => {
    expect(heroRoster.map((hero) => hero.id)).toEqual(["wizard", "warrior", "warlock", "thief", "swordsman", "seer"]);
    expect(getHeroById("warrior").abilities).toContain("May reroll both dice in combat.");
    expect(getHeroById("thief").abilities).toContain("Wins monster ties.");
    expect(getHeroById("seer").abilities).toContain("Gets +1 attack if the first move causes combat.");
  });

  it("cycles hero selection and persists the selected hero id", () => {
    const originalLocalStorage = globalThis.localStorage;
    const localStorageStub = createLocalStorageStub();
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: localStorageStub });

    try {
      localStorageStub.clear();

      expect(getNextHeroId("wizard", 1)).toBe("warrior");
      expect(getNextHeroId("wizard", -1)).toBe("seer");

      setSelectedHeroPreference("warlock");
      expect(getSelectedHeroId()).toBe("warlock");
    } finally {
      Object.defineProperty(globalThis, "localStorage", { configurable: true, value: originalLocalStorage });
    }
  });
});
