import { expect, test } from "bun:test";
import {
  advancePiece,
  applyHold,
  emptyBoard,
  fits,
  isPosition,
  lock,
  moveCandidates,
  PIECES,
  spawnPose,
  type Position,
} from "./game";
import { buildJevRequest } from "./jev";

const initial = (): Position => ({
  board: emptyBoard(),
  piece: "T",
  next: "I",
  nextAfter: "O",
  hold: null,
  canHold: true,
  activePose: { x: 0, y: 8, rotation: 2 },
});

test("normal and hold placements share one request with distinct IDs and correct previews", () => {
  const position = initial();
  const candidates = moveCandidates(position);
  const request = buildJevRequest(position, "jev-latest", candidates);
  expect(new Set(candidates.map((p) => p.id)).size).toBe(candidates.length);
  expect(candidates.some((p) => p.useHold)).toBe(true);
  expect(candidates.some((p) => !p.useHold)).toBe(true);
  for (const p of candidates) {
    expect(p.path[0]).toEqual(p.useHold ? spawnPose() : position.activePose!);
    expect(p.piece).toBe(p.useHold ? "I" : "T");
    expect(p.next).toBe(p.useHold ? "O" : "I");
    expect(p.hold).toBe(p.useHold ? "T" : null);
    for (const pose of p.path) expect(fits(position.board, p.piece, pose)).toBe(true);
    expect(lock(position.board, p.piece, p.pose).board).toEqual(p.board);
    expect(request.questions.move.criteria[p.id]).toMatchObject({
      useHold: p.useHold,
      piece: p.piece,
      next: p.useHold ? null : position.next,
      holdAfter: p.hold,
      nextCanSpawn: p.useHold ? null : fits(p.board, position.next, spawnPose()),
    });
  }
});

test("empty hold consumes exactly one queued piece and locking restores hold", () => {
  let draws = 0;
  const draw = () => {
    draws++;
    return "Z" as const;
  };
  const held = applyHold(initial(), draw);
  expect(draws).toBe(1);
  expect(held).toMatchObject({
    piece: "I",
    next: "O",
    nextAfter: "Z",
    hold: "T",
    canHold: false,
    activePose: spawnPose(),
  });
  expect(() => applyHold(held, draw)).toThrow("Hold unavailable");
  expect(draws).toBe(1);
  const next = advancePiece(held, held.board, draw);
  expect(next).toMatchObject({ piece: "O", next: "Z", hold: "T", canHold: true });
  expect(draws).toBe(2);
});

test("occupied hold swaps pieces without advancing the queue", () => {
  const position = { ...initial(), hold: "L" as const };
  const held = applyHold(position, () => {
    throw new Error("must not draw");
  });
  expect(held).toMatchObject({
    piece: "L",
    next: "I",
    nextAfter: "O",
    hold: "T",
    canHold: false,
    activePose: spawnPose(),
  });
  for (const p of moveCandidates(position).filter((p) => p.useHold)) {
    expect(p.piece).toBe("L");
    expect(p.next).toBe("I");
  }
});

test("replanning after a hold cannot hold again or reset the falling position", () => {
  const position = applyHold(initial(), () => "Z");
  position.activePose = { x: 0, y: 9, rotation: 1 };
  position.board[19][0] = 8;
  const candidates = moveCandidates(position);
  expect(candidates.length).toBeGreaterThan(0);
  expect(candidates.every((p) => !p.useHold)).toBe(true);
  expect(
    candidates.every((p) => JSON.stringify(p.path[0]) === JSON.stringify(position.activePose)),
  ).toBe(true);
});

test("a blocked replacement spawn does not remove valid normal placements", () => {
  const position = initial();
  position.board[1].fill(8);
  const candidates = moveCandidates(position);
  expect(candidates.length).toBeGreaterThan(0);
  expect(candidates.every((p) => !p.useHold)).toBe(true);
  expect(() => applyHold(position, () => "Z")).toThrow("Hold unavailable");
});

test("hold does not bypass an already blocked active spawn", () => {
  const position = { ...initial(), activePose: spawnPose() };
  position.board[0][4] = 8;
  expect(moveCandidates(position)).toEqual([]);
});

test("hold fields are validated while legacy positions remain valid", () => {
  expect(isPosition(initial())).toBe(true);
  expect(isPosition({ board: emptyBoard(), piece: "T", next: "I" })).toBe(true);
  expect(isPosition({ ...initial(), hold: "X" })).toBe(false);
  expect(isPosition({ ...initial(), canHold: "yes" })).toBe(false);
  expect(isPosition({ ...initial(), nextAfter: "X" })).toBe(false);
  expect(isPosition({ ...initial(), nextAfter: undefined })).toBe(false);
});

test("hidden queue changes cannot affect the Jev request or candidate evaluations", () => {
  for (const hold of [null, "L"] as const) {
    const position = { ...initial(), hold };
    // A high stack makes hidden-piece spawn evaluations differ if they leak.
    position.board[0][4] = 8;
    const request = buildJevRequest(position, "jev-latest", moveCandidates(position));
    expect(request.state).not.toHaveProperty("nextAfter");
    for (const nextAfter of PIECES) {
      const changed = { ...position, nextAfter };
      expect(buildJevRequest(changed, "jev-latest", moveCandidates(changed))).toEqual(request);
    }
    const held = Object.values(request.questions.move.criteria).filter((p) => p.useHold);
    expect(held.length).toBeGreaterThan(0);
    for (const candidate of held) {
      expect(candidate.next).toBe(hold ? position.next : null);
      if (!hold) expect(candidate.nextCanSpawn).toBeNull();
    }
  }
});
