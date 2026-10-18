# Othello × Jev

Play human vs Jev, Jev vs Jev, or human vs human.

Requires Bun 1.4.2+. Set `JEV_API_KEY` for Jev games (or mount a 1Password environment at `.env`).

```sh
# From the repository root
bun install --frozen-lockfile
cd othello
bun run dev
```

Open http://127.0.0.1:3000.

Select a fixed Jev model before starting a game. Changing the selector affects
only the next game. Move history shows the requested and returned models,
latency, and token counts. Use **Download game JSON** to save the current game,
including its initial board, moves, and Jev results, before starting another
game or reloading the page.

## Checks

```sh
bun run test
bun run lint
bun run fmt:check
```
