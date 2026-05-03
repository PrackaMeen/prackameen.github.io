const BOARD_SIZE = 19;
const CENTER = Math.floor(BOARD_SIZE / 2);
const CORNERS = [
  { x: 0, y: 0 },
  { x: BOARD_SIZE - 1, y: 0 },
  { x: 0, y: BOARD_SIZE - 1 },
  { x: BOARD_SIZE - 1, y: BOARD_SIZE - 1 }
];
const MONSTER_POSITIONS = [
  { x: CENTER, y: CENTER },
  { x: CENTER - 1, y: CENTER },
  { x: CENTER + 1, y: CENTER },
  { x: CENTER, y: CENTER - 1 },
  { x: CENTER, y: CENTER + 1 },
  { x: CENTER - 2, y: CENTER },
  { x: CENTER + 2, y: CENTER },
  { x: CENTER, y: CENTER - 2 },
  { x: CENTER, y: CENTER + 2 }
];

function buildGameStartSession(participants = [], options = {}) {
  const boardSize = Number.isInteger(options.boardSize) && options.boardSize > 0 ? options.boardSize : BOARD_SIZE;
  const board = buildGameBoard(boardSize);
  const players = normalizeParticipants(participants).slice(0, 4);
  const activePlayerId = players[0]?.id ?? null;

  placePlayers(board, players, boardSize);
  placeMonsters(board, players.length, options.monsterCount);

  return {
    boardWidth: boardSize,
    boardHeight: boardSize,
    board,
    seed: options.seed ?? null,
    players: players.map((player, index) => ({
      ...player,
      position: CORNERS[index] || null
    })),
    currentPlayerId: activePlayerId,
    activePlayerId
  };
}

function normalizeParticipants(participants) {
  return (Array.isArray(participants) ? participants : [])
    .filter((participant) => participant && (participant.name || participant.nickname || participant.peerId))
    .map((participant, index) => ({
      id: participant.id || participant.peerId || `player-${index + 1}`,
      name: participant.name || participant.nickname || participant.peerId || `Player ${index + 1}`,
      type: participant.type || (participant.isBot ? "monster" : "player"),
      characterIcon: participant.characterIcon || participant.icon || "",
      colorHex: participant.colorHex || participant.color || null,
      role: participant.role || (participant.isBot ? "monster" : "player")
    }));
}

function buildGameBoard(boardSize) {
  const cells = [];

  for (let y = 0; y < boardSize; y += 1) {
    for (let x = 0; x < boardSize; x += 1) {
      const { tileKind, tileOrientation } = resolveTile(x, y, boardSize);
      cells.push({ x, y, tileKind, tileOrientation });
    }
  }

  return cells;
}

function resolveTile(x, y, boardSize) {
  const center = Math.floor(boardSize / 2);
  const ring = Math.min(x, y, boardSize - 1 - x, boardSize - 1 - y);

  if (ring === 0) {
    return {
      tileKind: "road0",
      tileOrientation: resolveBorderOrientation(x, y, boardSize)
    };
  }

  if (ring === 1) {
    return {
      tileKind: "road1",
      tileOrientation: (x + y) % 2
    };
  }

  if (ring === 2) {
    return {
      tileKind: "road2",
      tileOrientation: resolveCornerOrientation(x, y, boardSize)
    };
  }

  if (x === center || y === center) {
    return {
      tileKind: x === center && y === center ? "road4" : "road3",
      tileOrientation: (x + y) % 4
    };
  }

  if (ring === 3) {
    return {
      tileKind: "chamber0",
      tileOrientation: (x + y) % 4
    };
  }

  if (ring === 4) {
    return {
      tileKind: "chamber1",
      tileOrientation: (x + y) % 4
    };
  }

  if (ring === 5) {
    return {
      tileKind: "chamber2",
      tileOrientation: (x + y) % 4
    };
  }

  if (ring === 6) {
    return {
      tileKind: "chamber3",
      tileOrientation: (x + y) % 4
    };
  }

  return {
    tileKind: "chamber4",
    tileOrientation: (x + y) % 4
  };
}

function resolveBorderOrientation(x, y, boardSize) {
  if (y === 0) {
    return 0;
  }

  if (x === boardSize - 1) {
    return 1;
  }

  if (y === boardSize - 1) {
    return 2;
  }

  return 3;
}

function resolveCornerOrientation(x, y, boardSize) {
  if (x <= 2 && y <= 2) {
    return 0;
  }

  if (x >= boardSize - 3 && y <= 2) {
    return 1;
  }

  if (x >= boardSize - 3 && y >= boardSize - 3) {
    return 2;
  }

  return 3;
}

function placePlayers(board, players, boardSize) {
  players.forEach((player, index) => {
    const position = CORNERS[index];
    if (!position) {
      return;
    }

    setEntity(board, boardSize, position.x, position.y, {
      entityKind: "player",
      entityId: player.id,
      entityName: player.name,
      entityColorHex: player.colorHex || null,
      occupantId: index + 1,
      occupantName: player.name,
      occupantAlive: true
    });
  });
}

function placeMonsters(board, playerCount, monsterCount) {
  const usedPositions = new Set(CORNERS.slice(0, Math.min(playerCount, CORNERS.length)).map((position) => `${position.x},${position.y}`));
  const count = Number.isInteger(monsterCount) && monsterCount > 0 ? monsterCount : 5;
  let placed = 0;

  for (const position of [...CORNERS, ...MONSTER_POSITIONS]) {
    if (placed >= count) {
      break;
    }

    const key = `${position.x},${position.y}`;
    if (usedPositions.has(key)) {
      continue;
    }

    usedPositions.add(key);
    placed += 1;
    setEntity(board, BOARD_SIZE, position.x, position.y, {
      entityKind: "monster",
      entityId: `monster-${placed}`,
      entityName: `Monster ${placed}`,
      entityColorHex: "#b91c1c",
      occupantId: 1000 + placed,
      occupantName: `Monster ${placed}`,
      occupantAlive: true
    });
  }
}

function setEntity(board, boardSize, x, y, entity) {
  const index = (y * boardSize) + x;
  if (index < 0 || index >= board.length) {
    return;
  }

  board[index] = {
    ...board[index],
    ...entity
  };
}

export {
  BOARD_SIZE,
  buildGameStartSession
};
