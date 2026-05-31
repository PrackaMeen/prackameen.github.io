function getOrientation(cell) {
  return Number.isInteger(cell?.tileOrientation) ? cell.tileOrientation : Number.isInteger(cell?.orientation) ? cell.orientation : 0;
}

export function canTraverseBetweenCells(fromCell, toCell, { normalizeTileKind, getTileWalls }) {
  const fromWalls = getTileWalls(
    normalizeTileKind(fromCell.tileKind || fromCell.kind || fromCell.terrainKind),
    getOrientation(fromCell)
  );
  const toWalls = getTileWalls(
    normalizeTileKind(toCell.tileKind || toCell.kind || toCell.terrainKind),
    getOrientation(toCell)
  );

  if (fromCell.x === toCell.x) {
    if (fromCell.y < toCell.y) {
      return !fromWalls.south && !toWalls.north;
    }

    return !fromWalls.north && !toWalls.south;
  }

  if (fromCell.y === toCell.y) {
    if (fromCell.x < toCell.x) {
      return !fromWalls.east && !toWalls.west;
    }

    return !fromWalls.west && !toWalls.east;
  }

  return false;
}

export function canExitTowardsTarget(fromCell, source, target, { normalizeTileKind, getTileWalls, areOrthogonallyAdjacent }) {
  if (!fromCell || !areOrthogonallyAdjacent(source, target)) {
    return false;
  }

  const fromWalls = getTileWalls(
    normalizeTileKind(fromCell.tileKind || fromCell.kind || fromCell.terrainKind),
    getOrientation(fromCell)
  );

  if (target.x > source.x) {
    return !fromWalls.east;
  }

  if (target.x < source.x) {
    return !fromWalls.west;
  }

  if (target.y > source.y) {
    return !fromWalls.south;
  }

  return !fromWalls.north;
}