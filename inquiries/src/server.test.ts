import { afterEach, expect, spyOn, test } from "bun:test";
import { handleTriage } from "./api";
import { inquiries } from "./data";
import { startServer } from "./server";

const originalKey = process.env.JEV_API_KEY;
let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, "fetch">> | undefined;

afterEach(() => {
  fetchSpy?.mockRestore();
  fetchSpy = undefined;
  if (originalKey === undefined) delete process.env.JEV_API_KEY;
  else process.env.JEV_API_KEY = originalKey;
});

function request(body = JSON.stringify({ id: inquiries[0].id }), origin = "http://localhost:4325") {
  return new Request("http://localhost:4325/api/triage", {
    method: "POST",
    headers: { origin, "Content-Type": "application/json" },
    body,
  });
}

test("rejects cross-origin and malformed requests without contacting Jev", async () => {
  fetchSpy = spyOn(globalThis, "fetch").mockRejectedValue(new Error("Unexpected API call"));
  expect((await handleTriage(request(undefined, "http://other.example"))).status).toBe(403);
  expect((await handleTriage(request("{"))).status).toBe(400);
  expect((await handleTriage(request('{"id":"unknown"}'))).status).toBe(400);
  expect((await handleTriage(request("null"))).status).toBe(400);
  expect(fetchSpy).not.toHaveBeenCalled();
});

test("reports a missing API key without contacting Jev", async () => {
  delete process.env.JEV_API_KEY;
  fetchSpy = spyOn(globalThis, "fetch").mockRejectedValue(new Error("Unexpected API call"));
  expect((await handleTriage(request())).status).toBe(503);
  expect(fetchSpy).not.toHaveBeenCalled();
});

test("returns validated classifications through the POST handler", async () => {
  process.env.JEV_API_KEY = "test-key";
  const score = { score: 1, confidence: 0.9, probabilities: { "0": 0, "1": 1, "2": 0, "3": 0 } };
  const answers = {
    urgency: score,
    pressure: score,
    department: {
      choice: "support",
      confidence: 0.9,
      probabilities: {
        support: 1,
        engineering: 0,
        billing: 0,
        sales: 0,
        product: 0,
        success: 0,
        unknown: 0,
      },
    },
  };
  fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ answers }));
  const response = await handleTriage(request());
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject(answers);
});

test("hides upstream errors from the API response", async () => {
  process.env.JEV_API_KEY = "test-key";
  fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
    new Response("private-detail", { status: 401 }),
  );
  const response = await handleTriage(request());
  expect(response.status).toBe(502);
  expect(await response.text()).not.toContain("private-detail");
});

test("serves the React entrypoint and routes API requests", async () => {
  delete process.env.JEV_API_KEY;
  const server = startServer(0);
  try {
    const page = await fetch(server.url);
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain('id="root"');
    expect(html).toContain("Inquiry triage");
    const script = /src="([^"]+\.js)"/.exec(html)?.[1];
    if (!script) throw new Error("Missing bundled React entrypoint");
    expect((await fetch(new URL(script, server.url))).status).toBe(200);
    const response = await fetch(new URL("/api/triage", server.url), {
      method: "POST",
      headers: { origin: server.url.origin, "Content-Type": "application/json" },
      body: JSON.stringify({ id: inquiries[0].id }),
    });
    expect(response.status).toBe(503);
    expect((await fetch(new URL("/missing", server.url))).status).toBe(404);
  } finally {
    await server.stop(true);
  }
});
