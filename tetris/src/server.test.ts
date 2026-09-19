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
