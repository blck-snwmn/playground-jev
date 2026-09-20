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

## Checks

```sh
bun run test
bun run lint
bun run fmt:check
```
