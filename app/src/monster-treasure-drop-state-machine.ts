export interface MonsterTreasureDropDefinition {
  treasureKey: string;
  displayName: string;
  symbol: string;
  colorHex: string;
}

const defaultTreasureDrop: MonsterTreasureDropDefinition = {
  treasureKey: "treasure",
  displayName: "Treasure",
  symbol: "T",
  colorHex: "#ffd166"
};

const defaultTreasureDropTable = new Map<number, MonsterTreasureDropDefinition>([
  [0, { treasureKey: "coin", displayName: "Coin", symbol: "C", colorHex: "#ffd166" }],
  [1, { treasureKey: "gem", displayName: "Gem", symbol: "G", colorHex: "#7cf7a3" }],
  [2, { treasureKey: "relic", displayName: "Relic", symbol: "R", colorHex: "#8fb8ff" }],
  [3, { treasureKey: "charm", displayName: "Charm", symbol: "H", colorHex: "#f59ae4" }],
  [4, { treasureKey: "orb", displayName: "Orb", symbol: "O", colorHex: "#ff8b5e" }],
  [5, { treasureKey: "crown", displayName: "Crown", symbol: "W", colorHex: "#ffe066" }]
]);

export class MonsterTreasureDropStateMachine {
  constructor(
    private readonly treasureDropTable: ReadonlyMap<number, MonsterTreasureDropDefinition> = defaultTreasureDropTable
  ) {}

  public resolveTreasureDrop(monsterIndex: number): MonsterTreasureDropDefinition {
    return this.treasureDropTable.get(monsterIndex) ?? defaultTreasureDrop;
  }
}