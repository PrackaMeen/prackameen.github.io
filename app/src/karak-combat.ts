import type { HeroDefinition } from "./hero-roster";
import type { SeededRandom } from "./seeded-rng";

export interface KarakCombatResolution {
	rolls: number[];
	heroTotal: number;
	monsterTotal: number;
	victory: boolean;
	tie: boolean;
}

export function resolveKarakCombat(hero: HeroDefinition, monsterTotal: number, rng: SeededRandom, isFirstStepOfTurn: boolean): KarakCombatResolution {
	const heroBonus = hero.attackBonus + (hero.id === "seer" && isFirstStepOfTurn ? 1 : 0);
	let rolls = [rng.rollDie(), rng.rollDie()];

	if (hero.rerollOnOnes && rolls.some((roll) => roll === 1)) {
		rolls = rolls.map((roll) => (roll === 1 ? rng.rollDie() : roll));
	}

	let heroTotal = rolls.reduce((sum, roll) => sum + roll, 0) + heroBonus;

	if (hero.rerollBothOnLoss && heroTotal <= monsterTotal) {
		rolls = [rng.rollDie(), rng.rollDie()];
		heroTotal = rolls.reduce((sum, roll) => sum + roll, 0) + heroBonus;
	}

	const tie = heroTotal === monsterTotal;
	const victory = heroTotal > monsterTotal || (hero.tieWins && tie);

	return { rolls, heroTotal, monsterTotal, victory, tie };
}