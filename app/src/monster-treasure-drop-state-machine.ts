import {
  dropTableById,
  monsterDropMapByMonsterId,
  monsterIndexById,
  monsterTable
} from "./game-data";

export interface MonsterTreasureDropDefinition {
  monsterId: string;
  dropId: string;
  monsterIndex: number;
  hp: number;
  monsterSpriteAnimationId: string;
  dropSpriteAnimationId: string;
  treasureKey: string;
  displayName: string;
  symbol: string;
  colorHex: string;
}

const defaultTreasureDrop: MonsterTreasureDropDefinition = {
  monsterId: "unknown",
  dropId: "treasure",
  monsterIndex: -1,
  hp: 0,
  monsterSpriteAnimationId: "monster0",
  dropSpriteAnimationId: "treasure0",
  treasureKey: "treasure",
  displayName: "Treasure",
  symbol: "T",
  colorHex: "#ffd166"
};

const treasurePresentationByDropId: Record<string, { symbol: string; colorHex: string }> = {
  coin: { symbol: "C", colorHex: "#ffd166" },
  gem: { symbol: "G", colorHex: "#7cf7a3" },
  relic: { symbol: "R", colorHex: "#8fb8ff" },
  charm: { symbol: "H", colorHex: "#f59ae4" },
  orb: { symbol: "O", colorHex: "#ff8b5e" },
  crown: { symbol: "W", colorHex: "#ffe066" }
};

const defaultTreasureDropTable = new Map<number, MonsterTreasureDropDefinition>(
  monsterTable.map((monsterRow, monsterIndex) => {
    const monsterDropRow = monsterDropMapByMonsterId.get(monsterRow.monsterId);
    const dropRow = monsterDropRow ? dropTableById.get(monsterDropRow.dropId) : undefined;
    const presentation = monsterDropRow ? treasurePresentationByDropId[monsterDropRow.dropId] : undefined;

    return [monsterIndex, {
      monsterId: monsterRow.monsterId,
      dropId: monsterDropRow?.dropId ?? defaultTreasureDrop.dropId,
      monsterIndex,
      hp: monsterRow.hp,
      monsterSpriteAnimationId: monsterRow.spriteAnimationId,
      dropSpriteAnimationId: monsterDropRow?.dropSpriteAnimationId ?? defaultTreasureDrop.dropSpriteAnimationId,
      treasureKey: monsterDropRow?.dropId ?? defaultTreasureDrop.treasureKey,
      displayName: dropRow?.displayName ?? defaultTreasureDrop.displayName,
      symbol: presentation?.symbol ?? defaultTreasureDrop.symbol,
      colorHex: presentation?.colorHex ?? defaultTreasureDrop.colorHex
    }];
  })
);

export class MonsterTreasureDropStateMachine {
  constructor(
    private readonly treasureDropTable: ReadonlyMap<number, MonsterTreasureDropDefinition> = defaultTreasureDropTable
  ) {}

  public resolveTreasureDrop(monsterIndex: number): MonsterTreasureDropDefinition {
    return this.treasureDropTable.get(monsterIndex) ?? defaultTreasureDrop;
  }

  public resolveMonsterIndexForTreasureKey(treasureKey: string): number {
    const monsterDropRow = [...monsterDropMapByMonsterId.values()].find((row) => row.dropId === treasureKey);

    if (!monsterDropRow) {
      return 0;
    }

    return monsterIndexById.get(monsterDropRow.monsterId) ?? 0;
  }
}