import { DEFAULT_JEV_MODEL, JEV_MODELS, isJevModel } from "@playground-jev/common";
import page from "./index.html";
import { getLegalMoves, isPosition } from "./game";
import { chooseJevMove, JevHttpError } from "./jev";

function errorResponse(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

export async function handleJevMove(request: Request): Promise<Response> {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return errorResponse("Send requests from this app.", 403);
  }

  const apiKey = process.env.JEV_API_KEY;
  if (!apiKey) {
    return errorResponse("Configure JEV_API_KEY in othello/.env and restart the server.", 503);
  }

  try {
    const position: unknown = await request.json();
    if (!isPosition(position)) return errorResponse("Invalid board position.", 400);
    if (getLegalMoves(position.board, position.player).length === 0) {
      return errorResponse("No legal moves available.", 400);
    }

    const model = "model" in position ? position.model : DEFAULT_JEV_MODEL;
    if (!isJevModel(model)) return errorResponse("Unsupported Jev model.", 400);
    return Response.json(await chooseJevMove(position, apiKey, model));
  } catch (error) {
    // Keep upstream response bodies and credentials out of client responses and logs.
    const message =
      error instanceof JevHttpError
        ? error.message
        : "Could not get a response from Jev. Check your connection and retry.";
    return errorResponse(message, 502);
  }
}

export function startServer(port = Number(process.env.PORT ?? 3000)) {
  return Bun.serve({
    port,
    hostname: "127.0.0.1",
    routes: {
      "/": page,
      "/api/status": () =>
        Response.json({
          configured: !!process.env.JEV_API_KEY,
          model: DEFAULT_JEV_MODEL,
          models: JEV_MODELS,
        }),
      "/api/jev": { POST: handleJevMove },
    },
    fetch: () => new Response("Not found", { status: 404 }),
  });
}
if (import.meta.main) {
  const server = startServer();
  console.log(`Othello: ${server.url}`);
}
