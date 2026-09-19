import { defineConfig } from "astro/config";
import node from "@astrojs/node";
import react from "@astrojs/react";

export default defineConfig({
  server: { host: "127.0.0.1", port: 4325 },
  vite: { server: { watch: { ignored: ["**/.env"] } } },
  output: "server",
  adapter: node({ mode: "standalone" }),
  integrations: [react()],
});
