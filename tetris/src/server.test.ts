import { afterEach, expect, spyOn, test } from "bun:test";
import { emptyBoard } from "./game";
import * as logs from "./log";
import { handleMove } from "./server";

const originalKey = process.env.JEV_API_KEY;
let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, "fetch">> | undefined;
let logSpy: ReturnType<typeof spyOn<typeof logs, "appendLog">> | undefined;
afterEach(() => {
  fetchSpy?.mockRestore();
  logSpy?.mockRestore();
  if (originalKey === undefined) delete process.env.JEV_API_KEY;
  else process.env.JEV_API_KEY = originalKey;
});
function moveRequest() {
  return new Request("http://localhost:3001/api/jev", {
    method: "POST",
    headers: { origin: "http://localhost:3001", "Content-Type": "application/json" },
    body: JSON.stringify({
      board: emptyBoard(),
      piece: "T",
      next: "I",
      gameId: crypto.randomUUID(),
      turn: 1,
    }),
  });
}
test("logs the exact request sent to Jev", async () => {
  process.env.JEV_API_KEY = "test-key";
  fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json({ answers: { move: { choice: "p0" } } }),
  );
  logSpy = spyOn(logs, "appendLog").mockResolvedValue(undefined);
  const response = await handleMove(moveRequest());
  expect(response.status).toBe(200);
  const sentBody = fetchSpy.mock.calls[0][1]?.body;
  if (typeof sentBody !== "string") throw new Error("Expected a JSON request body");
  expect(JSON.stringify(logSpy.mock.calls[0][1].request)).toBe(sentBody);
});
test("reports log failures separately from successful Jev calls", async () => {
  process.env.JEV_API_KEY = "test-key";
  fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json({ answers: { move: { choice: "p0" } } }),
  );
  logSpy = spyOn(logs, "appendLog").mockRejectedValue(new Error("disk full"));
  const response = await handleMove(moveRequest());
  expect(response.status).toBe(500);
  expect(await response.text()).toContain("Could not save the decision log");
});
test("does not log a decision when Jev fails", async () => {
  process.env.JEV_API_KEY = "test-key";
  fetchSpy = spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
  logSpy = spyOn(logs, "appendLog").mockResolvedValue(undefined);
  const response = await handleMove(moveRequest());
  expect(response.status).toBe(502);
  expect(logSpy).not.toHaveBeenCalled();
});

test("uses and logs the current pose when choosing a replacement path", async () => {
  process.env.JEV_API_KEY = "test-key";
  fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json({ answers: { move: { choice: "p0" } } }),
  );
  logSpy = spyOn(logs, "appendLog").mockResolvedValue(undefined);
  const board = emptyBoard();
  board[0].fill(8); // Spawn is blocked, but the falling piece below it can still move.
  const activePose = { x: 0, y: 10, rotation: 1 };
  const response = await handleMove(
    new Request("http://localhost:3001/api/jev", {
      method: "POST",
      headers: { origin: "http://localhost:3001", "Content-Type": "application/json" },
      body: JSON.stringify({
        board,
        piece: "I",
        next: "O",
        activePose,
        gameId: crypto.randomUUID(),
        turn: 2,
      }),
    }),
  );
  expect(response.status).toBe(200);
  const logged = logSpy.mock.calls[0][1];
  expect(logged.position).toMatchObject({ activePose });
  expect(logged.request).toMatchObject({ state: { activePose } });
});

test("accepts hold choices and logs the hold and preview state", async () => {
  process.env.JEV_API_KEY = "test-key";
  fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json({ answers: { move: { choice: "hp0" } } }),
  );
  logSpy = spyOn(logs, "appendLog").mockResolvedValue(undefined);
  const response = await handleMove(
    new Request("http://localhost:3001/api/jev", {
      method: "POST",
      headers: { origin: "http://localhost:3001", "Content-Type": "application/json" },
      body: JSON.stringify({
        board: emptyBoard(),
        piece: "T",
        next: "I",
        nextAfter: "O",
        hold: null,
        canHold: true,
        gameId: crypto.randomUUID(),
        turn: 1,
      }),
    }),
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ choice: "hp0" });
  const sentBody = fetchSpy.mock.calls[0][1]?.body;
  if (typeof sentBody !== "string") throw new Error("Expected a JSON request body");
  const sent: unknown = JSON.parse(sentBody);
  expect(sent).not.toHaveProperty("state.nextAfter");
  expect(sent).toHaveProperty("questions.move.criteria.hp0.next", null);
  expect(sent).toHaveProperty("questions.move.criteria.hp0.nextCanSpawn", null);
  expect(logSpy.mock.calls[0][1].request).toMatchObject({
    state: { hold: null, canHold: true },
    questions: {
      move: {
        criteria: {
          hp0: { useHold: true, piece: "I", next: null, holdAfter: "T", nextCanSpawn: null },
        },
      },
    },
  });
});
