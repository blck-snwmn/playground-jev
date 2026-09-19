import page from "./index.html";
import { getLegalMoves, isPosition } from "./game";
import { chooseJevMove, JevHttpError } from "./jev";

const model = process.env.TYPESAFE_MODEL || "jev-latest";

function errorResponse(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

async function handleJevMove(request: Request): Promise<Response> {
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

const server = Bun.serve({
  hostname: "127.0.0.1",
  port: Number(process.env.PORT || 3000),
  routes: {
    "/": page,
    "/api/status": () => Response.json({ configured: !!process.env.JEV_API_KEY, model }),
    "/api/jev": { POST: handleJevMove },
  },
  fetch: () => new Response("Not found", { status: 404 }),
});

console.log(`Othello: ${server.url}`);
