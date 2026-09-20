import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const apps = [
  { cwd: "othello", entry: "src/server.ts", title: "Othello", api: "/api/jev" },
  { cwd: "tetris", entry: "src/server.ts", title: "Tetris", api: "/api/jev" },
  { cwd: "inquiries", entry: "src/server.ts", title: "Inquiry triage", api: "/api/triage" },
  { cwd: "inquiries/dist", entry: "server.js", title: "Inquiry triage", api: "/api/triage" },
];

for (const app of apps) {
  test(`${app.cwd}: serves bundled JS/CSS and protects API routes`, async () => {
    const child = Bun.spawn([process.execPath, "--no-env-file", app.entry], {
      cwd: `${root}/${app.cwd}`,
      // Do not inherit credentials or local .env files; no live Jev calls are needed.
      env: {
        PATH: process.env.PATH,
        PORT: "0",
        NODE_ENV: app.cwd.endsWith("dist") ? "production" : "development",
      },
      stdout: "pipe",
      stderr: "inherit",
    });
    const timer = setTimeout(() => child.kill(), 15_000);
    try {
      let output = "";
      let address: string | undefined;
      const reader = child.stdout.getReader();
      try {
        while (!address) {
          const { done, value } = await reader.read();
          if (done) throw new Error(`Server exited before readiness: ${output}`);
          output += new TextDecoder().decode(value);
          address = /http:\/\/127\.0\.0\.1:\d+\//.exec(output)?.[0];
        }
      } finally {
        reader.releaseLock();
      }
      const url = new URL(address);
      const get = (path: string) =>
        fetch(new URL(path, url), { signal: AbortSignal.timeout(5_000) });
      const page = await get("/");
      expect(page.status).toBe(200);
      const html = await page.text();
      expect(html).toContain(app.title);
      const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]);
      const styles = [...html.matchAll(/<link[^>]+href="([^"]+\.css)"/g)].map((m) => m[1]);
      expect(scripts.length).toBeGreaterThan(0);
      expect(styles.length).toBeGreaterThan(0);
      for (const asset of [...scripts, ...styles]) {
        const response = await get(asset);
        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toMatch(
          asset.endsWith(".css") ? /text\/css/ : /javascript/,
        );
        expect((await response.text()).length).toBeGreaterThan(0);
      }
      expect((await get("/missing")).status).toBe(404);
      const rejected = await fetch(new URL(app.api, url), {
        method: "POST",
        headers: { origin: "https://other.example", "Content-Type": "application/json" },
        body: "{}",
        signal: AbortSignal.timeout(5_000),
      });
      expect(rejected.status).toBe(403);
      if (app.api === "/api/jev") {
        const status = await get("/api/status");
        expect(status.status).toBe(200);
        expect(await status.json()).toEqual({ configured: false, model: "jev-latest" });
      }
    } finally {
      clearTimeout(timer);
      child.kill();
      await child.exited;
    }
  }, 20_000);
}
