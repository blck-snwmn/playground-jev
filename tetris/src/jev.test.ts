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
