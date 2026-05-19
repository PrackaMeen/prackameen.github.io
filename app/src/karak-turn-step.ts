export interface KarakTurnStepState {
	turnIndex: number;
	stepsRemaining: number;
	stepsPerTurn: number;
}

export interface KarakTurnStepConsumptionResult {
	state: KarakTurnStepState;
	turnEnded: boolean;
}

export function createKarakTurnStepState(turnIndex: number = 0, stepsPerTurn: number = 4): KarakTurnStepState {
	const normalizedStepsPerTurn = Math.max(1, Math.floor(stepsPerTurn));

	return {
		turnIndex,
		stepsRemaining: normalizedStepsPerTurn,
		stepsPerTurn: normalizedStepsPerTurn
	};
}

export function consumeKarakTurnStep(state: KarakTurnStepState): KarakTurnStepConsumptionResult {
	if (state.stepsRemaining <= 0) {
		return { state, turnEnded: true };
	}

	const nextStepsRemaining = state.stepsRemaining - 1;

	if (nextStepsRemaining > 0) {
		return {
			state: {
				...state,
				stepsRemaining: nextStepsRemaining
			},
			turnEnded: false
		};
	}

	return {
		state: {
			turnIndex: state.turnIndex + 1,
			stepsRemaining: state.stepsPerTurn,
			stepsPerTurn: state.stepsPerTurn
		},
		turnEnded: true
	};
}