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

## Compare models and languages

Select one of the 12 inquiries to see its English and Japanese versions and
compare four conditions: `jev-1.13.0` / `jev-1.14.0` × English / Japanese.
Only the inquiry title and body change language. The fictional service
context, instructions, department definitions, and scoring scales stay in
English for every condition.

**Run missing conditions** evaluates only conditions without a successful
result. **Run all 4 again** repeats the comparison; each column also has its
own classification button. Requests run sequentially and stop at the first
failure. A failed rerun keeps the previous successful result and marks it as
previous. Recording times identify when each result was obtained.

The comparison shows urgency, request pressure, department selection and
recommendation, confidence, returned model, latency, and token counts.
Expand **Show probabilities** for each condition's full distributions.
The recommendation threshold changes display policy without another API call.
Scores are positions on a rubric, and confidence is derived from the probability
distribution; neither is a measured accuracy score. The sample set has no
reference labels, so differences alone do not establish an improvement.

Expand **All 12 inquiries** to review or classify the remaining samples for
one model and language. Results are kept separately by inquiry, model, and
language until page reload. **Download results JSON** exports all successful
runs from this session, including reruns, in schema version 2. Each run contains
the localized inquiry text and a result with its language, requested/returned
models, elapsed time, token usage, and recording time. Missing upstream
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
