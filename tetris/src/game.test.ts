import { describe, expect, test } from "bun:test";
import {
  cells,
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
    board[0][0] = 8;
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
