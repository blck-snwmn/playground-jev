import page from "./index.html";
import { handleTriage } from "./api";

export function startServer(port = Number(process.env.PORT ?? 4325)) {
  return Bun.serve({
    hostname: "127.0.0.1",
    port,
    development: process.env.NODE_ENV !== "production",
    routes: {
      "/": page,
      "/api/triage": { POST: handleTriage },
    },
    fetch: () => new Response("Not found", { status: 404 }),
  });
}

if (import.meta.main) {
  const server = startServer();
  console.log(`Inquiries: ${server.url}`);
}
