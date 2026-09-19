import page from "./index.html";
import { isPosition, placements } from "./game";
import { appendLog, isLogContext, isUuid } from "./log";
import { buildJevRequest, chooseMove } from "./jev";
export async function handleMove(request: Request): Promise<Response> {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return Response.json({ error: "Send requests from this app." }, { status: 403 });
  let position: unknown;
  try {
    position = await request.json();
  } catch {
    return Response.json({ error: "Invalid board position." }, { status: 400 });
  }
  if (!isPosition(position) || !isLogContext(position))
    return Response.json({ error: "No valid placements available." }, { status: 400 });
  const candidates = placements(position);
  if (!candidates.length)
    return Response.json({ error: "No valid placements available." }, { status: 400 });
  const apiKey = process.env.JEV_API_KEY;
  if (!apiKey)
    return Response.json(
      { error: "Configure JEV_API_KEY in tetris/.env and restart the server." },
      { status: 503 },
    );
  // Build once: send, validate, and log the same choices and request.
  const jevRequest = buildJevRequest(position, "jev-latest", candidates);
  const requestId = crypto.randomUUID();
  let result: Awaited<ReturnType<typeof chooseMove>>;
  try {
    result = await chooseMove(jevRequest, apiKey);
  } catch {
    return Response.json(
      {
        error:
          "Could not get a decision from Jev. Check your connection and API configuration, then resume.",
      },
      { status: 502 },
    );
  }
  try {
    await appendLog(position.gameId, {
      type: "decision",
      turn: position.turn,
      requestId,
      position,
      before: jevRequest.state.currentMetrics,
      request: jevRequest,
      candidates: candidates.map(({ path: _path, ...candidate }) => candidate),
      result,
    });
  } catch {
    return Response.json(
      { error: "Could not save the decision log. Check disk space and the server, then resume." },
      { status: 500 },
    );
  }
  return Response.json({ ...result, requestId });
}
async function handleEvent(request: Request): Promise<Response> {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return Response.json({ error: "Send requests from this app." }, { status: 403 });
  try {
    const value: unknown = await request.json();
    if (!isPosition(value) || !isLogContext(value))
      return new Response("Invalid event", { status: 400 });
    const event = value as typeof value & {
      type?: unknown;
      requestId?: unknown;
      totalLines?: unknown;
    };
    if (
      !["placed", "game_over"].includes(String(event.type)) ||
      !Number.isSafeInteger(event.totalLines) ||
      Number(event.totalLines) < 0 ||
      (event.type === "placed" && !isUuid(event.requestId))
    )
      return new Response("Invalid event", { status: 400 });
    await appendLog(value.gameId, {
      type: event.type,
      turn: value.turn,
      requestId: event.requestId,
      totalLines: event.totalLines,
      position: { board: value.board, piece: value.piece, next: value.next },
    });
    return Response.json({ saved: true });
  } catch {
    return Response.json({ error: "Could not save the log." }, { status: 500 });
  }
}
if (import.meta.main) {
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: process.env.PORT || 3001,
    routes: {
      "/": page,
      "/api/status": () =>
        Response.json({ configured: !!process.env.JEV_API_KEY, model: "jev-latest" }),
      "/api/jev": { POST: handleMove },
      "/api/log": { POST: handleEvent },
    },
    fetch: () => new Response("Not found", { status: 404 }),
  });
  console.log(`Tetris: ${server.url}`);
}
