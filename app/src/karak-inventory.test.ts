import { describe, expect, it } from "vitest";
import { resolveKarakInventoryAdd } from "./karak-inventory";

describe("karak inventory capacity", () => {
	it("stores an item in the next available slot when space remains", () => {
		const result = resolveKarakInventoryAdd(["sword", "scroll"], "key", 6);

		expect(result).toEqual({
			items: ["sword", "scroll", "key"],
			stored: true,
			droppedItem: null,
			slotIndex: 2
		});
	});

	it("drops the item when inventory is full", () => {
		const result = resolveKarakInventoryAdd(["sword", "scroll", "key"], "gem", 3);

		expect(result).toEqual({
			items: ["sword", "scroll", "key"],
			stored: false,
			droppedItem: "gem",
			slotIndex: null
		});
	});

	it("treats negative capacity as zero", () => {
		const result = resolveKarakInventoryAdd([], "ring", -2);

		expect(result).toEqual({
			items: [],
			stored: false,
			droppedItem: "ring",
			slotIndex: null
		});
	});
});