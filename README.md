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
bun run lint
bun run fmt:check
```

CI uses the exact Bun version in `package.json` and installs the workspace with
`bun install --frozen-lockfile`. The root checks include every app's existing
checks and formatting checks for the root configuration. Lint enables both
`typeAware` and `typeCheck`, so it also reports TypeScript errors using each
package's `tsconfig.json`; a separate typecheck command is unnecessary.

```sh
bun run build  # Build Inquiries (Othello/Tetris run directly from source)
```

CI runs the existing workspace tests without adding new tests. They mock Jev
responses; CI does not call the live service or automate browser interactions.

GitHub Actions security checks use the versions pinned in `aqua.yaml`:

```sh
aqua install
pinact run --check
zizmor --format github .
```
