export interface KarakHealthFlowState {
	health: number;
	isUnconscious: boolean;
	revivePending: boolean;
}

export function applyKarakMonsterDamage(health: number, maxHealth: number, damage: number = 1): KarakHealthFlowState {
	const nextHealth = Math.max(0, Math.min(maxHealth, health - damage));
	const isUnconscious = nextHealth === 0;

	return {
		health: nextHealth,
		isUnconscious,
		revivePending: isUnconscious
	};
}

export function reviveKarakHero(state: KarakHealthFlowState): KarakHealthFlowState {
	if (!state.isUnconscious && !state.revivePending) {
		return state;
	}

	return {
		health: 1,
		isUnconscious: false,
		revivePending: false
	};
}

export function applyKarakFountainHeal(state: KarakHealthFlowState, maxHealth: number): KarakHealthFlowState {
	const fullHealth = Math.max(0, maxHealth);

	if (state.health === fullHealth && !state.isUnconscious && !state.revivePending) {
		return state;
	}

	return {
		health: fullHealth,
		isUnconscious: false,
		revivePending: false
	};
}