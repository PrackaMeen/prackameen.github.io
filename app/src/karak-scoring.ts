export interface KarakScoreBreakdown {
	openedTreasureChests: number;
	dragonRubyCollected: boolean;
	chestPoints: number;
	rubyPoints: number;
	totalScore: number;
}

export function calculateKarakScore(openedTreasureChests: number, dragonRubyCollected: boolean = false): KarakScoreBreakdown {
	const normalizedChestCount = Math.max(0, Math.floor(openedTreasureChests));
	const chestPoints = normalizedChestCount;
	const rubyPoints = dragonRubyCollected ? 1.5 : 0;

	return {
		openedTreasureChests: normalizedChestCount,
		dragonRubyCollected,
		chestPoints,
		rubyPoints,
		totalScore: chestPoints + rubyPoints
	};
}