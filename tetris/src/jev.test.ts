import { afterEach, expect, spyOn, test } from "bun:test";
import { emptyBoard, placements } from "./game";
import { buildJevRequest, chooseMove } from "./jev";
const position = { board: emptyBoard(), piece: "T" as const, next: "I" as const };
const request = buildJevRequest(position, "jev-latest", placements(position));
let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, "fetch">> | undefined;
afterEach(() => fetchSpy?.mockRestore());
test("accepts a legal upstream choice", async () => {
  fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json({ answers: { move: { choice: "p0" } } }),
  );
  expect((await chooseMove(request, "test-key")).choice).toBe("p0");
});
test("rejects a choice outside reachable placements", async () => {
  fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json({ answers: { move: { choice: "invalid" } } }),
  );
  expect(
    await chooseMove(request, "test-key").catch((error: unknown) =>
      error instanceof Error ? error.message : String(error),
    ),
  ).toBe("Invalid Jev choice");
});
test("upstream errors do not expose response bodies", async () => {
  fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
    new Response("private upstream details", { status: 401 }),
  );
  expect(
    await chooseMove(request, "test-key").catch((error: unknown) =>
      error instanceof Error ? error.message : String(error),
    ),
  ).toBe("Jev request failed");
});
test("network failure stops the request", async () => {
  fetchSpy = spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
  expect(
    await chooseMove(request, "test-key").catch((error: unknown) =>
      error instanceof Error ? error.message : String(error),
    ),
  ).toBe("offline");
});

test("marks top-out candidates while preserving the full choice set", () => {
  const board = [
    "..........",
    "..........",
    "##..#.....",
    "##.##.....",
    "#####.###.",
    "#########.",
    "#########.",
    "########..",
    "########..",
    "#####.##..",
    "########..",
    "###.##....",
    "######....",
    "######....",
    "####.#.#..",
    "######.#..",
    "######.#.#",
    "######.#.#",
    "#####.####",
    ".#########",
  ].map((row) => row.split("").map((cell) => (cell === "#" ? 1 : 0)));
  const position = { board, piece: "S" as const, next: "O" as const };
  const candidates = placements(position);
  const choices = buildJevRequest(position, "jev-latest", candidates).questions.move.criteria;
  const fatal = candidates.find((p) => p.pose.x === 2 && p.pose.y === 1 && p.pose.rotation === 0)!;
  const safe = candidates.find((p) => p.pose.x === 6 && p.pose.y === 2 && p.pose.rotation === 0)!;
  expect(choices[fatal.id].nextCanSpawn).toBe(false);
  expect(choices[safe.id].nextCanSpawn).toBe(true);
  expect(placements({ board: fatal.board, piece: position.next, next: "I" })).toHaveLength(0);
  expect(placements({ board: safe.board, piece: position.next, next: "I" }).length).toBeGreaterThan(
    0,
  );
  expect(Object.keys(choices)).toEqual(candidates.map((p) => p.id));
});

test("evaluates next-piece spawning after completed rows clear", () => {
  const board = emptyBoard();
  for (let y = 2; y < 20; y++) board[y] = Array.from({ length: 10 }, (_, x) => (x === 5 ? 0 : 1));
  const position = { board, piece: "I" as const, next: "O" as const };
  const candidates = placements(position);
  const clear = candidates.find((p) => p.lines === 4)!;
  expect(clear).toBeDefined();
  expect(
    buildJevRequest(position, "jev-latest", candidates).questions.move.criteria[clear.id]
      .nextCanSpawn,
  ).toBe(true);
});
