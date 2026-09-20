# Tetris × Jev

Interrupt Jev while it chooses placements and stacks tetrominoes.

Earn a ticket every 4 lines cleared by Jev. **Use ticket** pauses the game and reveals a random obstacle. Hover over the board to preview its landing position, then click to place it. Placing it consumes the ticket and resumes play; the next ticket unlocks after Jev places 3 pieces.

Rows completed by obstacles clear immediately before Jev reconsiders, without counting toward lines or tickets.

Requires Bun 1.4.2+. Set `JEV_API_KEY` in `.env` (or mount the 1Password `jev` Environment at `tetris/.env`).

```sh
# From the repository root
bun install --frozen-lockfile
cd tetris
bun run dev
```

Open http://127.0.0.1:3001. Use `PORT` to change the port.

## Checks

```sh
bun run test
bun run lint
bun run typecheck
bun run fmt:check
```

Decision logs are saved to `logs/<game UUID>.jsonl` (ignored by Git).
