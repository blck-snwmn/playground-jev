import page from "./index.html";
import { handleLocate } from "./api";

export function startServer(port = Number(process.env.PORT ?? 4326)) {
  return Bun.serve({
    hostname: "127.0.0.1",
    port,
    maxRequestBodySize: 17 * 1024 * 1024,
    development: process.env.NODE_ENV !== "production",
    routes: { "/": page, "/api/locate": { POST: handleLocate } },
    fetch: () => new Response("Not found", { status: 404 }),
  });
}
if (import.meta.main) console.log(`Box: ${startServer().url}`);
