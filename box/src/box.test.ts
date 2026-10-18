import { afterEach, expect, spyOn, test } from "bun:test";
import { handleLocate } from "./api";
import { preparedSize, validatePreparedImage } from "./image";
import { answersSchema } from "./schema";
import { startServer } from "./server";

const originalKey = process.env.JEV_API_KEY;
let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, "fetch">> | undefined;
afterEach(() => {
  fetchSpy?.mockRestore();
  fetchSpy = undefined;
  if (originalKey === undefined) delete process.env.JEV_API_KEY;
  else process.env.JEV_API_KEY = originalKey;
});
// Header fixture: full image decoding is performed by the browser and upstream API.
function pngHeader(width = 800, height = 600) {
  const bytes = new Uint8Array(24);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return new File([bytes], "image.png", { type: "image/png" });
}
function body(question = "左のりんごはどこ？", image = pngHeader()) {
  const form = new FormData();
  form.append("question", question);
  form.append("image", image);
  return form;
}
function request(form = body(), origin = "http://localhost:4326") {
  return new Request("http://localhost:4326/api/locate", {
    method: "POST",
    headers: { origin },
    body: form,
  });
}
const answers = {
  present: { type: "noul", noul: 0.9 },
  target: { type: "box", box: { left: 0.2, right: 0.4, top: 0.3, bottom: 0.8 }, confidence: 0.8 },
};
test("preparation fits large images without distortion and pads short sides", () => {
  expect(preparedSize(4000, 3000)).toEqual({
    width: 1568,
    height: 1176,
    contentWidth: 1568,
    contentHeight: 1176,
  });
  expect(preparedSize(100, 200)).toEqual({
    width: 280,
    height: 280,
    contentWidth: 100,
    contentHeight: 200,
  });
  expect(preparedSize(5000, 100)).toEqual({
    width: 1568,
    height: 280,
    contentWidth: 1568,
    contentHeight: 31,
  });
});
test("prepared image limits and signature are checked", async () => {
  expect(await validatePreparedImage(pngHeader(280, 1568))).toBe(true);
  for (const file of [
    pngHeader(279, 300),
    pngHeader(300, 1569),
    new File(["not a PNG"], "fake.png", { type: "image/png" }),
  ]) {
    expect(await validatePreparedImage(file)).toBe(false);
  }
});
test("invalid origin, question and image never contact Jev", async () => {
  fetchSpy = spyOn(globalThis, "fetch").mockRejectedValue(new Error("Unexpected API call"));
  expect((await handleLocate(request(body(), "https://other.example"))).status).toBe(403);
  for (const form of [
    body(" "),
    body("a".repeat(1001)),
    body("target", pngHeader(20, 20)),
    new FormData(),
  ]) {
    expect((await handleLocate(request(form))).status).toBe(400);
  }
  expect(fetchSpy).not.toHaveBeenCalled();
});
test("missing key is reported before contacting Jev", async () => {
  delete process.env.JEV_API_KEY;
  fetchSpy = spyOn(globalThis, "fetch").mockRejectedValue(new Error("Unexpected API call"));
  expect((await handleLocate(request())).status).toBe(503);
  expect(fetchSpy).not.toHaveBeenCalled();
});
test("multipart transport pins model, opts in, and sends one shared image for both questions", async () => {
  process.env.JEV_API_KEY = "test-key";
  fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json({ answers, model: "jev-1.14.0", usage: { input_tokens: 120 } }),
  );
  const response = await handleLocate(request());
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    ...answers,
    requestedModel: "jev-1.14.0",
    usage: { input_tokens: 120, output_tokens: null },
  });
  const options = fetchSpy.mock.calls[0][1];
  expect(new Headers(options?.headers).get("TypeSafe-Danger-Zone-Images")).toBe("true");
  expect(new Headers(options?.headers).get("Content-Type")).toBeNull();
  const sent = options?.body;
  if (!(sent instanceof FormData)) throw new Error("Expected multipart");
  expect([...sent.keys()]).toEqual(["request", "photo"]);
  const json = sent.get("request");
  if (!(json instanceof Blob)) throw new Error("Expected JSON part");
  const payload = JSON.parse(await json.text()) as {
    state: { photo: string };
    assets: Record<string, unknown>;
  };
  expect(payload).toMatchObject({
    model: "jev-1.14.0",
    state: { request: "左のりんごはどこ？" },
    questions: { present: { type: "noul" }, target: { type: "box" } },
  });
  expect(payload.assets[payload.state.photo]).toEqual({ type: "image", part: "photo" });
});
test("rejects invalid coordinates and accepts unknown confidence", () => {
  expect(
    answersSchema.safeParse({ ...answers, target: { ...answers.target, confidence: null } })
      .success,
  ).toBe(true);
  for (const box of [
    { left: -0.1, right: 0.4, top: 0, bottom: 1 },
    { left: 0.8, right: 0.4, top: 0, bottom: 1 },
    { left: 0, right: 1, top: 0.5, bottom: 0.5 },
  ])
    expect(
      answersSchema.safeParse({ ...answers, target: { ...answers.target, box } }).success,
    ).toBe(false);
});
test("upstream failures and malformed results become safe errors", async () => {
  process.env.JEV_API_KEY = "test-key";
  fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
    new Response("private-detail", { status: 400 }),
  );
  let response = await handleLocate(request());
  expect(response.status).toBe(502);
  expect(await response.text()).not.toContain("private-detail");
  fetchSpy.mockResolvedValue(
    Response.json({ answers: { ...answers, target: { type: "box", box: null } } }),
  );
  response = await handleLocate(request());
  expect(response.status).toBe(502);
});
test("serves the app and routes uploads", async () => {
  delete process.env.JEV_API_KEY;
  const server = startServer(0);
  try {
    const page = await fetch(server.url);
    expect(page.status).toBe(200);
    expect(await page.text()).toContain("画像の中を探す");
    const response = await fetch(new URL("/api/locate", server.url), {
      method: "POST",
      headers: { origin: server.url.origin },
      body: body(),
    });
    expect(response.status).toBe(503);
    expect((await fetch(new URL("/missing", server.url))).status).toBe(404);
  } finally {
    await server.stop(true);
  }
});
