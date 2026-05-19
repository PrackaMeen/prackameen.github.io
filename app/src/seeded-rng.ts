function hashSeed(seed: string): number {
	let hash = 2166136261;

	for (let index = 0; index < seed.length; index += 1) {
		hash ^= seed.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}

	return hash >>> 0;
}

export class SeededRandom {
	private state: number;

	constructor(seed: string) {
		this.state = hashSeed(seed) || 1;
	}

	public next(): number {
		let value = this.state;
		value ^= value << 13;
		value ^= value >>> 17;
		value ^= value << 5;
		this.state = value >>> 0;
		return this.state / 0x100000000;
	}

	public nextInt(maxExclusive: number): number {
		if (maxExclusive <= 0) {
			return 0;
		}

		return Math.floor(this.next() * maxExclusive);
	}

	public rollDie(sides: number = 6): number {
		return this.nextInt(sides) + 1;
	}

	public rollDice(count: number, sides: number = 6): number[] {
		return Array.from({ length: Math.max(0, count) }, () => this.rollDie(sides));
	}

	public skip(rollCount: number): void {
		for (let index = 0; index < Math.max(0, rollCount); index += 1) {
			this.next();
		}
	}
}