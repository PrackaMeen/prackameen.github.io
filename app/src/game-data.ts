import monsterTableCsv from "./data/monster-table.csv?raw";
import dropTableCsv from "./data/drop-table.csv?raw";
import monsterDropMapCsv from "./data/monster-drop-map.csv?raw";

export interface MonsterTableRow {
  monsterId: string;
  displayName: string;
  hp: number;
  spriteAnimationId: string;
}

export interface DropTableRow {
  dropId: string;
  displayName: string;
  spriteAnimationId: string;
}

export interface MonsterDropMapRow {
  monsterId: string;
  dropId: string;
  monsterSpriteAnimationId: string;
  dropSpriteAnimationId: string;
}

function parseCsvRows(csvText: string, expectedHeader: string[]): string[][] {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    throw new Error("CSV is empty.");
  }

  const [headerLine, ...dataLines] = lines;
  const header = headerLine.split(",").map((cell) => cell.trim());

  if (header.length !== expectedHeader.length || expectedHeader.some((cell, index) => header[index] !== cell)) {
    throw new Error(`CSV has an unexpected header. Expected: ${expectedHeader.join(",")}.`);
  }

  return dataLines.map((line) => {
    const cells = line.split(",").map((cell) => cell.trim());

    if (cells.length !== expectedHeader.length) {
      throw new Error(`CSV row has ${cells.length} columns, expected ${expectedHeader.length}.`);
    }

    return cells;
  });
}

function parseMonsterTable(csvText: string): MonsterTableRow[] {
  return parseCsvRows(csvText, ["id", "display-name", "hp", "sprite-animation-id"]).map((cells) => {
    const hp = Number.parseInt(cells[2], 10);

    if (!Number.isInteger(hp) || hp < 0) {
      throw new Error(`Monster CSV contains an invalid hp value: ${cells[2]}.`);
    }

    return {
      monsterId: cells[0],
      displayName: cells[1],
      hp,
      spriteAnimationId: cells[3]
    };
  });
}

function parseDropTable(csvText: string): DropTableRow[] {
  return parseCsvRows(csvText, ["id", "display-name", "sprite-animation-id"]).map((cells) => ({
    dropId: cells[0],
    displayName: cells[1],
    spriteAnimationId: cells[2]
  }));
}

function parseMonsterDropMap(csvText: string): MonsterDropMapRow[] {
  return parseCsvRows(csvText, ["monster-id", "drop-id", "monster-sprite-animation-id", "drop-sprite-animation-id"]).map((cells) => ({
    monsterId: cells[0],
    dropId: cells[1],
    monsterSpriteAnimationId: cells[2],
    dropSpriteAnimationId: cells[3]
  }));
}

export const monsterTable = parseMonsterTable(monsterTableCsv);
export const dropTable = parseDropTable(dropTableCsv);
export const monsterDropMap = parseMonsterDropMap(monsterDropMapCsv);

export const monsterTableById = new Map(monsterTable.map((row) => [row.monsterId, row]));
export const dropTableById = new Map(dropTable.map((row) => [row.dropId, row]));
export const monsterIndexById = new Map(monsterTable.map((row, index) => [row.monsterId, index]));
export const monsterDropMapByMonsterId = new Map(monsterDropMap.map((row) => [row.monsterId, row]));
export const monsterDropMapByDropId = new Map(monsterDropMap.map((row) => [row.dropId, row]));

for (const row of monsterDropMap) {
  const monster = monsterTableById.get(row.monsterId);
  const drop = dropTableById.get(row.dropId);

  if (!monster) {
    throw new Error(`Monster drop map references unknown monster id ${row.monsterId}.`);
  }

  if (!drop) {
    throw new Error(`Monster drop map references unknown drop id ${row.dropId}.`);
  }

  if (monster.spriteAnimationId !== row.monsterSpriteAnimationId) {
    throw new Error(`Monster drop map animation id mismatch for monster ${row.monsterId}.`);
  }

  if (drop.spriteAnimationId !== row.dropSpriteAnimationId) {
    throw new Error(`Monster drop map animation id mismatch for drop ${row.dropId}.`);
  }
}