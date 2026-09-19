# Othello × Jev

Play human vs Jev, Jev vs Jev, or human vs human.

Requires Bun 1.4.2+. Set `JEV_API_KEY` for Jev games (or mount a 1Password environment at `.env`).

```sh
cd othello
bun install --frozen-lockfile
bun run dev
```

Open http://127.0.0.1:3000.

## Checks

```sh
bun run test
bun run lint
bun run typecheck
bun run fmt:check
```
