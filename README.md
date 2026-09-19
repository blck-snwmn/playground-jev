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

## Checks

Check all apps:

```sh
bun run test
bun run typecheck
bun run lint
bun run fmt:check
```
