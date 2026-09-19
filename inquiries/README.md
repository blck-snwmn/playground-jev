# Inquiry triage × Jev

An Astro + React + Bun app that uses Jev to assess urgency, request pressure, and department recommendations for 12 fictional inquiries.

## Run

```sh
# From the repository root
bun install --frozen-lockfile
cd inquiries
cp .env.example .env
# Set JEV_API_KEY in .env
bun run dev
```

## Commands

```sh
bun run test       # Tests without API calls
bun run typecheck # Astro check
bun run lint      # Oxlint
bun run fmt:check # Oxfmt (.astro files excluded)
bun run build
bun run start     # Run the built app
```

Inquiries and service context are in `src/data.ts`, department roles and scoring scales in `src/triage.ts`, and Jev requests in `src/jev.ts`.
