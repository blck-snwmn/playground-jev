import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appendLog, isLogContext } from "./log";
import { emptyBoard, placements } from "./game";
import { buildJevRequest } from "./jev";

test("rejects unsafe filenames and invalid turn numbers", () => {
  expect(isLogContext({ gameId: "../../secret", turn: 1 })).toBe(false);
  expect(isLogContext({ gameId: crypto.randomUUID(), turn: 0 })).toBe(false);
  expect(isLogContext({ gameId: crypto.randomUUID(), turn: 1.5 })).toBe(false);
  expect(isLogContext({ gameId: crypto.randomUUID(), turn: 1 })).toBe(true);
});

test("persists candidates, selected move, and completion events per game", async () => {
  const directory = await mkdtemp(join(tmpdir(), "tetris-log-"));
  try {
    const gameId = crypto.randomUUID();
    const position = { board: emptyBoard(), piece: "T" as const, next: "I" as const };
    const candidates = placements(position);
    await appendLog(
      gameId,
      {
        type: "decision",
        turn: 1,
        request: buildJevRequest(position, "jev-latest", placements(position)),
        candidates,
        result: { choice: candidates[0].id },
      },
      directory,
    );
    await appendLog(gameId, { type: "placed", turn: 1 }, directory);
    await appendLog(gameId, { type: "game_over", turn: 2 }, directory);
    const content = await readFile(join(directory, `${gameId}.jsonl`), "utf8");
    const events = content
      .trim()
      .split("\n")
      .map(
        (line) =>
          JSON.parse(line) as { type: string; request?: ReturnType<typeof buildJevRequest> },
      );
    expect(events.map((event) => event.type)).toEqual(["decision", "placed", "game_over"]);
    expect(events[0].request).toEqual(
      buildJevRequest(position, "jev-latest", placements(position)),
    );
    expect(content).not.toContain("Authorization");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
