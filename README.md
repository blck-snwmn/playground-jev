# playground-jev

Small apps for experimenting with Jev.

- [Othello](./othello/README.md): Play against Jev or watch Jev play itself. Built with Bun.
- [Inquiries](./inquiries/README.md): Compare urgency, wording, and department suggestions for fixed sample inquiries. Built with React and Bun.
- [Tetris](./tetris/README.md): Watch Jev choose placements and stack tetrominoes. Built with Bun.

## Setup

Requires Bun 1.4.2+. Run from the repository root:

```sh
bun install --frozen-lockfile
bun run --filter jev-othello dev
```

Replace `jev-othello` with `jev-tetris` or `jev-inquiries`. See each app's README for `.env` setup.

## Model selection and results

All three apps offer `jev-1.13.0` and `jev-1.14.0`, defaulting to `jev-1.13.0`.
They send fixed model IDs so an alias update cannot silently change a run.
Results record the requested model, the returned model, elapsed milliseconds,
input/output token counts, and recording time. Missing upstream metadata is
shown as unavailable and saved as `null`.

Othello and Tetris keep the chosen model for the entire game. Othello exports
its current game as JSON; Tetris saves decisions in its existing JSONL logs.
Inquiries compares English and Japanese versions across both models, keeps
results separately per model and language, and exports every successful run
in the current browser session. Download browser results before reloading or
starting a new Othello game.

`common/` contains the shared model list and result metadata helpers.

## Checks

Check all apps:

```sh
bun run test
bun run lint
bun run fmt:check
```

CI uses the exact Bun version in `package.json` and installs the workspace with
`bun install --frozen-lockfile`. The root commands run each app's checks and
check formatting of the root configuration. Lint enables both `typeAware` and
`typeCheck`, so it also reports TypeScript errors using each package's
`tsconfig.json`.

```sh
bun run build  # Build Inquiries (Othello/Tetris run directly from source)
```

CI runs the workspace tests, which mock Jev responses.

GitHub Actions security checks use the versions pinned in `aqua.yaml`:

```sh
aqua install
pinact run --check
zizmor --format github .
```
