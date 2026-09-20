import { describe, expect, test } from "bun:test";
import {
  cells,
  randomObstacle,
  canPlaceObstacle,
  hasObstaclePlacement,
  placeObstacle,
  pathMoves,
  stepMove,
  createBag,
  emptyBoard,
  fits,
  isPosition,
  lock,
  metrics,
  placements,
  PIECES,
} from "./game";
import { buildJevRequest } from "./jev";
describe("Tetris rules", () => {
  test("each bag contains all seven pieces", () => {
    const draw = createBag();
    for (let n = 0; n < 4; n++)
      expect(new Set(Array.from({ length: 7 }, () => draw())).size).toBe(7);
  });
  test("all candidates have valid reachable paths and rest on something", () => {
    for (const piece of PIECES) {
      const board = emptyBoard();
      board[19][4] = 1;
      board[18][4] = 1;
      const options = placements({ board, piece, next: "I" });
      expect(options.length).toBeGreaterThan(0);
      for (const p of options) {
        for (let i = 0; i < p.path.length; i++) {
          expect(fits(board, piece, p.path[i])).toBe(true);
          if (i) {
            const a = p.path[i - 1],
              b = p.path[i];
            expect(
              Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Number(a.rotation !== b.rotation),
            ).toBe(1);
          }
        }
        expect(fits(board, piece, { ...p.pose, y: p.pose.y + 1 })).toBe(false);
        expect(cells(piece, p.pose)).toHaveLength(4);
      }
    }
  });
  test("clears four rows without changing original board", () => {
    const board = emptyBoard();
    for (let y = 16; y < 20; y++)
      board[y] = Array.from({ length: 10 }, (_, x) => (x === 5 ? 0 : 1));
    const result = lock(board, "I", { x: 3, y: 16, rotation: 1 });
    expect(result.lines).toBe(4);
    expect(result.board).toEqual(emptyBoard());
    expect(board[19][0]).toBe(1);
  });
  test("blocked spawn ends the game", () => {
    const board = emptyBoard();
    board[0].fill(1);
    board[1].fill(1);
    expect(placements({ board, piece: "T", next: "I" })).toEqual([]);
  });
  test("counts buried holes", () => {
    const board = emptyBoard();
    board[17][0] = 1;
    expect(metrics(board)).toEqual({ holes: 2, height: 3, bumpiness: 3 });
  });
  test("rejects malformed positions", () => {
    expect(isPosition(null)).toBe(false);
    expect(isPosition({ board: [], piece: "I", next: "O" })).toBe(false);
    const board = emptyBoard();
    board[0][0] = 9;
    expect(isPosition({ board, piece: "I", next: "O" })).toBe(false);
  });
  test("Jev choice keys map to placements", () => {
    const position = { board: emptyBoard(), piece: "T" as const, next: "I" as const };
    expect(
      Object.keys(
        buildJevRequest(position, "jev-latest", placements(position)).questions.move.criteria,
      ),
    ).toEqual(placements(position).map((p) => p.id));
  });
});

describe("obstacle game", () => {
  test("random orientations contain no duplicate silhouettes", () => {
    const expected = [2, 1, 4, 2, 2, 4, 4];
    for (let p = 0; p < PIECES.length; p++) {
      const rotations = new Set<number>();
      for (let r = 0; r < 100; r++) {
        let call = 0;
        const obstacle = randomObstacle(() => (call++ === 0 ? (p + 0.5) / 7 : r / 100));
        expect(obstacle.piece).toBe(PIECES[p]);
        rotations.add(obstacle.rotation);
      }
      expect(rotations.size).toBe(expected[p]);
    }
  });
  test("requires support, empty cells, and no overlap with the active piece", () => {
    const board = emptyBoard();
    const obstacle = { piece: "O" as const, rotation: 0 };
    const active = { piece: "T" as const, pose: { x: 3, y: 0, rotation: 0 } };
    expect(canPlaceObstacle(board, obstacle, { x: 0, y: 17, rotation: 0 }, active)).toBe(false);
    expect(canPlaceObstacle(board, obstacle, { x: 0, y: 18, rotation: 0 }, active)).toBe(true);
    expect(canPlaceObstacle(board, obstacle, { x: -2, y: 18, rotation: 0 }, active)).toBe(false);
    expect(
      canPlaceObstacle(
        board,
        obstacle,
        { x: 0, y: 18, rotation: 0 },
        {
          piece: "I",
          pose: { x: 0, y: 18, rotation: 0 },
        },
      ),
    ).toBe(false);
    board[19][1] = 8;
    expect(canPlaceObstacle(board, obstacle, { x: 0, y: 18, rotation: 0 }, active)).toBe(false);
    expect(canPlaceObstacle(board, obstacle, { x: 0, y: 17, rotation: 0 }, active)).toBe(true);
    board[19][1] = 0;
    board[17][0] = 8; // Side contact alone does not support the obstacle.
    expect(canPlaceObstacle(board, obstacle, { x: 0, y: 17, rotation: 0 }, active)).toBe(false);
  });
  test("replaying operations without interference preserves every candidate outcome", () => {
    for (const piece of PIECES) {
      const board = emptyBoard();
      board[19][4] = 8;
      for (const candidate of placements({ board, piece, next: "I" })) {
        let pose = candidate.path[0];
        for (const move of pathMoves(candidate.path)) {
          const step = stepMove(board, piece, pose, move);
          expect(step.landed).toBe(false);
          pose = step.pose;
        }
        expect(stepMove(board, piece, pose, "down").landed).toBe(true);
        expect(lock(board, piece, pose).board).toEqual(candidate.board);
      }
    }
  });
  test("blocked moves are skipped relatively; landing retains new obstacles", () => {
    const board = emptyBoard();
    const active = { piece: "O" as const, pose: { x: 0, y: 16, rotation: 0 } };
    const changed = placeObstacle(
      board,
      { piece: "I", rotation: 1 },
      { x: 1, y: 16, rotation: 1 },
      active,
    );
    expect(isPosition({ board: changed, piece: "O", next: "I" })).toBe(true);
    expect(board[19][3]).toBe(0);
    const blocked = stepMove(changed, active.piece, active.pose, "right");
    expect(blocked.pose).toEqual(active.pose);
    const down = stepMove(changed, active.piece, blocked.pose, "down");
    expect(down.pose).toEqual({ x: 0, y: 17, rotation: 0 });
    const landed = stepMove(changed, active.piece, down.pose, "down");
    expect(stepMove(changed, active.piece, landed.pose, "down").landed).toBe(true);
    expect(lock(changed, active.piece, landed.pose).board[19][3]).toBe(8);
  });
  test("obstacle clears its completed row immediately without credit on the next lock", () => {
    const board = emptyBoard();
    board[19].fill(1);
    for (let x = 0; x < 4; x++) board[19][x] = 0;
    const active = { piece: "O" as const, pose: { x: 5, y: 17, rotation: 0 } };
    const changed = placeObstacle(
      board,
      { piece: "I", rotation: 0 },
      { x: 0, y: 18, rotation: 0 },
      active,
    );
    expect(changed).toEqual(emptyBoard());
    expect(board[19].filter(Boolean)).toHaveLength(6);
    expect(active.pose).toEqual({ x: 5, y: 17, rotation: 0 });
    expect(lock(changed, active.piece, { ...active.pose, y: 18 }).lines).toBe(0);
  });
});

describe("obstacles with no placement", () => {
  test("a playable board can have no room for the revealed orientation", () => {
    const board = emptyBoard();
    for (let y = 8; y < 20; y++) {
      board[y].fill(1);
      board[y][y % 10] = 0;
    }
    const active = { piece: "O" as const, pose: { x: 3, y: 0, rotation: 0 } };
    expect(placements({ board, piece: active.piece, next: "T" }).length).toBeGreaterThan(0);
    expect(hasObstaclePlacement(board, { piece: "I", rotation: 1 }, active)).toBe(false);
    expect(hasObstaclePlacement(board, { piece: "I", rotation: 0 }, active)).toBe(true);
  });
  test("Jev can block the only supported location until it moves away", () => {
    const board = emptyBoard();
    for (let y = 0; y < 20; y++) {
      board[y].fill(1);
      board[y][y % 10] = 0;
      if (y >= 6 && y < 10) board[y][4] = board[y][5] = 0;
    }
    const obstacle = { piece: "O" as const, rotation: 0 };
    expect(
      hasObstaclePlacement(board, obstacle, { piece: "O", pose: { x: 3, y: 8, rotation: 0 } }),
    ).toBe(false);
    expect(
      hasObstaclePlacement(board, obstacle, { piece: "O", pose: { x: 3, y: 6, rotation: 0 } }),
    ).toBe(true);
  });
  test("a low edge slot remains usable beside a high stack", () => {
    const board = emptyBoard();
    for (let y = 0; y < 20; y++) {
      board[y].fill(1);
      board[y][0] = 0;
    }
    const active = { piece: "O" as const, pose: { x: 3, y: 0, rotation: 0 } };
    board[0][4] = board[0][5] = board[1][4] = board[1][5] = 0;
    expect(hasObstaclePlacement(board, { piece: "I", rotation: 1 }, active)).toBe(true);
  });
});

test("replanning starts at the current pose without rising past new obstacles", () => {
  const board = emptyBoard();
  for (let y = 0; y < 20; y++) board[y][5] = 8;
  const activePose = { x: 0, y: 10, rotation: 1 };
  const position = { board, piece: "I" as const, next: "O" as const, activePose };
  const options = placements(position);
  expect(options.length).toBeGreaterThan(0);
  for (const option of options) {
    expect(option.path[0]).toEqual(activePose);
    for (const pose of option.path) {
      expect(pose.y).toBeGreaterThanOrEqual(activePose.y);
      expect(fits(board, position.piece, pose)).toBe(true);
      expect(cells(position.piece, pose).every(([x]) => x < 5)).toBe(true);
    }
  }
  expect(buildJevRequest(position, "jev-latest", options).state.activePose).toEqual(activePose);
});

test("validates active poses before searching", () => {
  const position = { board: emptyBoard(), piece: "I", next: "O" };
  expect(isPosition({ ...position, activePose: { x: -2, y: 10, rotation: 1 } })).toBe(true);
  for (const activePose of [
    null,
    {},
    { x: 0, y: 0, rotation: 1000000 },
    { x: 0, y: 0.5, rotation: 0 },
    { x: 0, y: 20, rotation: 0 },
  ])
    expect(isPosition({ ...position, activePose })).toBe(false);
});

test("all obstacle cells must fit in the bottom fourteen rows", () => {
  const board = emptyBoard();
  const obstacle = { piece: "I" as const, rotation: 1 };
  const active = { piece: "O" as const, pose: { x: 3, y: 0, rotation: 0 } };
  board[10][2] = 1;
  expect(canPlaceObstacle(board, obstacle, { x: 0, y: 6, rotation: 1 }, active)).toBe(true);
  board[10][2] = 0;
  board[9][2] = 1;
  expect(canPlaceObstacle(board, obstacle, { x: 0, y: 5, rotation: 1 }, active)).toBe(false);
  expect(() => placeObstacle(board, obstacle, { x: 0, y: 5, rotation: 1 }, active)).toThrow();
});

test("discard is available when every supported position is above the limit", () => {
  const board = emptyBoard();
  for (let y = 6; y < 20; y++) board[y].fill(1);
  const active = { piece: "O" as const, pose: { x: 3, y: 0, rotation: 0 } };
  expect(hasObstaclePlacement(board, { piece: "I", rotation: 0 }, active)).toBe(false);
  expect(placements({ board, piece: active.piece, next: "I" }).length).toBeGreaterThan(0);
});

test("obstacle clears multiple rows and shifts the fixed stack before replanning", () => {
  const board = emptyBoard();
  for (const y of [18, 19]) {
    board[y].fill(1);
    board[y][1] = board[y][2] = 0;
  }
  board[12][8] = 3;
  const active = { piece: "T" as const, pose: { x: 4, y: 5, rotation: 0 } };
  const changed = placeObstacle(
    board,
    { piece: "O", rotation: 0 },
    { x: 0, y: 18, rotation: 0 },
    active,
  );
  expect(changed[14][8]).toBe(3);
  expect(changed.flat().filter(Boolean)).toHaveLength(1);
  expect(board[12][8]).toBe(3);
  const candidates = placements({
    board: changed,
    piece: active.piece,
    next: "I",
    activePose: active.pose,
  });
  expect(candidates.length).toBeGreaterThan(0);
  expect(candidates.every((p) => p.lines === 0)).toBe(true);
  expect(candidates[0].path[0]).toEqual(active.pose);
});
