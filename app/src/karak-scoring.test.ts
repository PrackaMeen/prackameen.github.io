import { describe, expect, it } from "vitest";
import { calculateKarakScore } from "./karak-scoring";

describe("karak scoring", () => {
	it("scores opened treasure chests at one point each", () => {
		expect(calculateKarakScore(3)).toEqual({
			openedTreasureChests: 3,
			dragonRubyCollected: false,
			chestPoints: 3,
			rubyPoints: 0,
			totalScore: 3
		});
	});

	it("adds the dragon ruby value on top of chest points", () => {
		expect(calculateKarakScore(4, true)).toEqual({
			openedTreasureChests: 4,
			dragonRubyCollected: true,
			chestPoints: 4,
			rubyPoints: 1.5,
			totalScore: 5.5
		});
	});

	it("normalizes negative chest counts to zero", () => {
		expect(calculateKarakScore(-8, true)).toEqual({
			openedTreasureChests: 0,
			dragonRubyCollected: true,
			chestPoints: 0,
			rubyPoints: 1.5,
			totalScore: 1.5
		});
	});
});