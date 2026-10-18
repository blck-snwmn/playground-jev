import { afterEach, expect, spyOn, test } from "bun:test";
import { BLACK, createInitialBoard } from "./game";
import { handleJevMove } from "./server";

const originalKey = process.env.JEV_API_KEY;
let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, "fetch">> | undefined;
afterEach(() => {
  fetchSpy?.mockRestore();
  if (originalKey === undefined) delete process.env.JEV_API_KEY;
  else process.env.JEV_API_KEY = originalKey;
});
function request(model: unknown) {
  return new Request("http://localhost:3000/api/jev", {
    method: "POST",
    headers: { origin: "http://localhost:3000", "Content-Type": "application/json" },
    body: JSON.stringify({ board: createInitialBoard(), player: BLACK, model }),
  });
}
test("sends the chosen fixed model and returns independently reported model and usage", async () => {
  process.env.JEV_API_KEY = "test-key";
  fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json({
      model: "jev-1.14.0",
      usage: { input_tokens: 100, output_tokens: null },
      answers: { move: { choice: "d3" } },
    }),
  );
  const response = await handleJevMove(request("jev-1.13.0"));
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    requestedModel: "jev-1.13.0",
    model: "jev-1.14.0",
    usage: { input_tokens: 100, output_tokens: null },
  });
  const body = fetchSpy.mock.calls[0][1]?.body;
  if (typeof body !== "string") throw new Error("Expected JSON");
  expect(JSON.parse(body)).toHaveProperty("model", "jev-1.13.0");
});
test("rejects unsupported model IDs before calling Jev", async () => {
  process.env.JEV_API_KEY = "test-key";
  fetchSpy = spyOn(globalThis, "fetch").mockRejectedValue(new Error("Unexpected API call"));
  for (const model of ["jev-latest", "other", null, 14])
    expect((await handleJevMove(request(model))).status).toBe(400);
  expect(fetchSpy).not.toHaveBeenCalled();
});
