# Tetris × Jev

Watch Jev choose a reachable placement for each tetromino. Built with Bun.

Requires Bun 1.4.2+. Mount the 1Password `jev` Environment at `tetris/.env`, or set `JEV_API_KEY` in a local `.env` (see `.env.example`). The start scripts explicitly load `.env` to support 1Password mounts.

```sh
cd tetris
bun install --frozen-lockfile
bun run dev
```

Open http://127.0.0.1:3001. Use `PORT` to change the port.

Start, pause/resume, reset, and adjust animation speed. Each piece makes one Jev request; thinking pauses gravity. Pause finishes the current piece, while reset discards the pending result. API errors stop play and allow retry. The API key stays on the local Bun server.

Rules: 10×20 board, shuffled seven-piece bags, clockwise rotation without wall kicks, no hold, full-row clears, and game over when the next piece cannot spawn. Placements are enumerated by reachable left/right/down/rotation paths. This is a simplified spectator game, not a full guideline implementation. Jev receives the board, next piece, and each candidate's resulting board, cleared lines, holes, height, and bumpiness.

```sh
bun run test
bun run lint
bun run typecheck
bun run fmt:check
```

## Decision logs

Each game writes `logs/<game UUID>.jsonl` locally (ignored by Git). Reloading or resetting starts a new game ID. The logging-enabled UI must be loaded before starting a game.

- `decision`: turn number, request ID, current board/pieces, baseline metrics, exact Jev request body, all candidate outcomes and poses, selected ID, and latency. No API key or authorization headers are recorded.
- `placed`: confirms that the selected move was applied, with the resulting board and cumulative lines. Match to `decision` by request ID. An unconfirmed decision may have been discarded by reset or page closure.
- `game_over`: final board and cumulative lines; its turn number is the next, unplayable turn. A file without this event is incomplete, not necessarily a loss.

For review, compare confirmed choices against alternatives for increased holes, height, roughness, and line clears, and trace how the stack deteriorates across turns. These are diagnostic signals, not proof that a locally better metric is the optimal long-term move. Logging itself does not change move selection. The current prompt explicitly prioritizes avoiding buried holes over a flatter surface, and includes current metrics and candidate-minus-current deltas after line clears. No lookahead or candidate filtering is added. The exact request in each decision log distinguishes prompt versions for comparison.

## Reading the code

- `src/game.ts`: board rules, reachable placements, metrics, and seven-piece bags. No network or UI code.
- `src/jev.ts`: describes the candidates to Jev and validates the returned choice against the exact request.
- `src/server.ts`: validates input, computes candidates once, builds and sends the request, then saves the decision before returning it. API and log failures have separate responses.
- `src/app.ts`: renders the board, animates the selected path, and handles pause, reset, and game over. Reset invalidates pending work; game over disables resume until a new game starts.
- `src/log.ts`: validates IDs and appends local JSONL records.

The browser computes placements for animation. The server computes its own candidates to validate client input; within that request, the candidates are reused for Jev and logging.
