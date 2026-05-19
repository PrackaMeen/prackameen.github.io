export type HeroId = "wizard" | "warrior" | "warlock" | "thief" | "swordsman" | "seer";

export interface HeroDefinition {
	id: HeroId;
	name: string;
	description: string;
	abilities: string[];
	attackBonus: number;
	tieWins: boolean;
	rerollBothOnLoss: boolean;
	rerollOnOnes: boolean;
}

export const heroRoster: HeroDefinition[] = [
	{
		id: "wizard",
		name: "Wizard",
		description: "Keeps magic scrolls after a magic shot and can move through already discovered corridors.",
		abilities: ["Keeps magic scrolls after using a magic shot.", "Moves through walls along already discovered corridors."],
		attackBonus: 0,
		tieWins: false,
		rerollBothOnLoss: false,
		rerollOnOnes: false
	},
	{
		id: "warrior",
		name: "Warrior",
		description: "Can reroll both dice in combat and respawns at the nearest healing fountain after losing the last life.",
		abilities: ["May reroll both dice in combat.", "Respawns at the nearest healing fountain after losing the last life."],
		attackBonus: 0,
		tieWins: false,
		rerollBothOnLoss: true,
		rerollOnOnes: false
	},
	{
		id: "warlock",
		name: "Warlock",
		description: "Can sacrifice a life once per turn for +1 attack and swap places with another hero.",
		abilities: ["May sacrifice a life once per turn for +1 attack.", "Can swap places with any other hero."],
		attackBonus: 1,
		tieWins: false,
		rerollBothOnLoss: false,
		rerollOnOnes: false
	},
	{
		id: "thief",
		name: "Thief",
		description: "Wins ties in monster fights and can choose whether to fight or ignore a monster.",
		abilities: ["Wins monster ties.", "May choose to fight or ignore a monster on entry."],
		attackBonus: 0,
		tieWins: true,
		rerollBothOnLoss: false,
		rerollOnOnes: false
	},
	{
		id: "swordsman",
		name: "Swordsman",
		description: "Can reroll a die showing 1 and may act again after a 6 even if the fight was lost or tied.",
		abilities: ["May reroll a die if it shows 1.", "May act again after a 6 even on a lost or tied fight."],
		attackBonus: 0,
		tieWins: false,
		rerollBothOnLoss: false,
		rerollOnOnes: true
	},
	{
		id: "seer",
		name: "Seer",
		description: "Gets +1 attack when the first move causes combat and can inspect two tokens in a new room.",
		abilities: ["Gets +1 attack if the first move causes combat.", "Draws two monster/treasure tokens in a new room and chooses one."],
		attackBonus: 1,
		tieWins: false,
		rerollBothOnLoss: false,
		rerollOnOnes: false
	}
];

const heroSelectionStorageKey = "karakHeroId";

export function getHeroById(heroId: string | null | undefined): HeroDefinition {
	return heroRoster.find((hero) => hero.id === heroId) ?? heroRoster[0];
}

export function getSelectedHeroId(): HeroId {
	const storedHeroId = globalThis.localStorage?.getItem(heroSelectionStorageKey);

	if (storedHeroId) {
		return getHeroById(storedHeroId).id;
	}

	if (typeof window === "undefined") {
		return heroRoster[0].id;
	}

	return getHeroById(storedHeroId).id;
}

export function getSelectedHero(): HeroDefinition {
	return getHeroById(getSelectedHeroId());
}

export function setSelectedHeroPreference(heroId: HeroId): void {
	globalThis.localStorage?.setItem(heroSelectionStorageKey, heroId);
}

export function getNextHeroId(currentHeroId: HeroId, step: 1 | -1): HeroId {
	const currentIndex = heroRoster.findIndex((hero) => hero.id === currentHeroId);
	const normalizedIndex = currentIndex >= 0 ? currentIndex : 0;
	const nextIndex = (normalizedIndex + step + heroRoster.length) % heroRoster.length;

	return heroRoster[nextIndex].id;
}