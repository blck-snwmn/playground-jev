import { describe, expect, test } from "bun:test";
import {
  createInitialBoard,
  getLegalMoves,
  applyMove,
  getFlippedDiscs,
  getNextPlayer,
  countDiscs,
  isPosition,
} from "./game";
describe("Othello rules", () => {
  test("sets up the initial position and legal moves for black", () => {
    expect(countDiscs(createInitialBoard())).toEqual({ black: 2, white: 2 });
    expect(getLegalMoves(createInitialBoard(), 1)).toEqual([19, 26, 37, 44]);
  });
  test("flips captured discs without mutating the original board", () => {
    const board = createInitialBoard();
    const next = applyMove(board, 1, 19);
    expect(countDiscs(next)).toEqual({ black: 4, white: 1 });
    expect(board[27]).toBe(-1);
    expect(getNextPlayer(next, 1)).toBe(-1);
    expect(() => applyMove(board, 1, 0)).toThrow();
  });
  test("does not capture across row boundaries", () => {
    const board = Array(64).fill(0);
    board[7] = -1;
    board[8] = 1;
    expect(getFlippedDiscs(board, 1, 6)).toEqual([]);
  });
  test("flips discs in all eight directions", () => {
    const board = Array(64).fill(0);
    for (const direction of [-9, -8, -7, -1, 1, 7, 8, 9]) {
      board[27 + direction] = -1;
      board[27 + 2 * direction] = 1;
    }
    expect(getFlippedDiscs(board, 1, 27)).toHaveLength(8);
  });
  test("passes when the opponent cannot move and ends when neither player can move", () => {
    const board = Array(64).fill(1);
    board[0] = 0;
    board[1] = -1;
    expect(getNextPlayer(board, 1)).toBe(1);
    expect(getNextPlayer(applyMove(board, 1, 0), 1)).toBe(null);
    const empty = Array(64).fill(0);
    expect(getNextPlayer(empty, 1)).toBe(null);
  });
  test("finishes complete games and preserves the total disc count", () => {
    for (let seed = 0; seed < 20; seed++) {
      let board = createInitialBoard(),
        player: 1 | -1 | null = 1,
        moveCount = 0;
      while (player !== null) {
        const moves = getLegalMoves(board, player);
        board = applyMove(board, player, moves[(seed + moveCount) % moves.length]);
        moveCount++;
        expect(countDiscs(board).black + countDiscs(board).white).toBe(4 + moveCount);
        player = getNextPlayer(board, player);
        expect(moveCount).toBeLessThanOrEqual(60);
      }
      expect(getLegalMoves(board, 1)).toEqual([]);
      expect(getLegalMoves(board, -1)).toEqual([]);
    }
  });
  test("validates board input", () => {
    expect(isPosition({ board: createInitialBoard(), player: 1 })).toBe(true);
    expect(isPosition({ board: [0], player: 1 })).toBe(false);
    expect(isPosition(null)).toBe(false);
  });
});
