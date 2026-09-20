import { expect, test } from "bun:test";
import { emptyBoard, obstacleLanding, canPlaceObstacle } from "./game";
const obstacle = { piece: "O" as const, rotation: 0 };
const active = { piece: "T" as const, pose: { x: 6, y: 0, rotation: 0 } };

test("preview falls vertically to support without changing the pointer column", () => {
  const board = emptyBoard();
  board[15][3] = 8;
  expect(obstacleLanding(board, obstacle, { x: 2, y: 6, rotation: 0 })).toEqual({
    x: 2,
    y: 13,
    rotation: 0,
  });
  expect(obstacleLanding(board, obstacle, { x: 5, y: 6, rotation: 0 })).toEqual({
    x: 5,
    y: 18,
    rotation: 0,
  });
  expect(obstacleLanding(board, obstacle, { x: 2, y: 16, rotation: 0 })).toEqual({
    x: 2,
    y: 18,
    rotation: 0,
  });
});
test("invalid origins and landings never snap sideways or cross blocks", () => {
  const board = emptyBoard();
  board[7][3] = 8;
  const high = obstacleLanding(board, obstacle, { x: 2, y: 0, rotation: 0 })!;
  expect(high.y).toBe(5);
  expect(canPlaceObstacle(board, obstacle, high, active)).toBe(false);
  expect(obstacleLanding(board, obstacle, { x: 2, y: 7, rotation: 0 })).toBeUndefined();
  expect(obstacleLanding(board, obstacle, { x: 9, y: 8, rotation: 0 })).toBeUndefined();
  expect(obstacleLanding(board, obstacle, { x: 2, y: 8, rotation: 0 })?.y).toBe(18);
});
test("preview ignores the falling piece but rejects overlap at the final landing", () => {
  const board = emptyBoard();
  const landing = obstacleLanding(board, obstacle, { x: 2, y: 6, rotation: 0 })!;
  expect(landing.y).toBe(18);
  const falling = { piece: "O" as const, pose: { x: 2, y: 12, rotation: 0 } };
  expect(canPlaceObstacle(board, obstacle, landing, falling)).toBe(true);
  expect(obstacleLanding(board, obstacle, falling.pose)).toEqual(landing);
  expect(canPlaceObstacle(board, obstacle, landing, { ...falling, pose: landing })).toBe(false);
});
