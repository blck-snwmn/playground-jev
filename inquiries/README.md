# Inquiry triage × Jev

A React + Bun app that uses Jev to assess urgency, request pressure, and department recommendations for 12 fictional inquiries.

## Run

```sh
# From the repository root
bun install --frozen-lockfile
cd inquiries
cp .env.example .env
# Set JEV_API_KEY in .env
bun run dev
```

Open http://127.0.0.1:4325. Use `PORT` to change the port.

## Commands

```sh
bun run test
bun run typecheck
bun run lint
bun run fmt:check
bun run build
bun run start     # Run the built app
```

Inquiries and service context are in `src/data.ts`, department roles and scoring scales in `src/triage.ts`, and Jev requests in `src/jev.ts`.
