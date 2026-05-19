import { describe, expect, it } from "vitest";
import { consumeKarakTurnStep, createKarakTurnStepState } from "./karak-turn-step";

describe("karak turn step accounting", () => {
	it("starts with a four-step turn budget by default", () => {
		expect(createKarakTurnStepState()).toEqual({
			turnIndex: 0,
			stepsRemaining: 4,
			stepsPerTurn: 4
		});
	});

	it("consumes one step without ending the turn while steps remain", () => {
		const result = consumeKarakTurnStep(createKarakTurnStepState(2));

		expect(result.turnEnded).toBe(false);
		expect(result.state).toEqual({
			turnIndex: 2,
			stepsRemaining: 3,
			stepsPerTurn: 4
		});
	});

	it("rolls the turn forward when the last step is consumed", () => {
		const result = consumeKarakTurnStep({
			turnIndex: 5,
			stepsRemaining: 1,
			stepsPerTurn: 4
		});

		expect(result.turnEnded).toBe(true);
		expect(result.state).toEqual({
			turnIndex: 6,
			stepsRemaining: 4,
			stepsPerTurn: 4
		});
	});

	it("keeps exhausted step state unchanged", () => {
		const exhaustedState = {
			turnIndex: 3,
			stepsRemaining: 0,
			stepsPerTurn: 4
		};

		const result = consumeKarakTurnStep(exhaustedState);

		expect(result.turnEnded).toBe(true);
		expect(result.state).toBe(exhaustedState);
	});
});