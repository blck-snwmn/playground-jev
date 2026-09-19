import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
const logDirectory = join(import.meta.dir, "../logs");
/** IDs are also used as local log filenames. */
export function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}
export function isLogContext(value: unknown): value is { gameId: string; turn: number } {
  if (!value || typeof value !== "object") return false;
  const context = value as { gameId?: unknown; turn?: unknown };
  return isUuid(context.gameId) && Number.isSafeInteger(context.turn) && Number(context.turn) >= 1;
}
export async function appendLog(
  gameId: string,
  event: Record<string, unknown>,
  directory = logDirectory,
) {
  if (!isUuid(gameId)) throw new Error("Invalid game ID");
  await mkdir(directory, { recursive: true });
  await appendFile(
    join(directory, `${gameId}.jsonl`),
    JSON.stringify({ schema: 1, at: new Date().toISOString(), ...event }) + "\n",
    { mode: 0o600 },
  );
}
