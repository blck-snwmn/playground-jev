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

Select `jev-1.13.0` or `jev-1.14.0` before classifying. The table shows results
for the selected model; switching models preserves previous results until
page reload. **Download results JSON** saves all successful runs from this
session, including repeated classifications, inquiry text, requested and
returned models, latency, token usage, and recording time. Missing upstream
metadata is saved as `null`.

## Commands

```sh
bun run test
bun run lint
bun run fmt:check
bun run build
bun run start     # Run the built app
```

Inquiries and service context are in `src/data.ts`, department roles and scoring scales in `src/triage.ts`, and Jev requests in `src/jev.ts`.
