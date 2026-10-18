import {
  DEFAULT_JEV_MODEL,
  JEV_MODELS,
  isJevModel,
  downloadJson,
  type JevModel,
} from "@playground-jev/common";
import { useRef, useState } from "react";
import type { TriageResult } from "./schema";
import { inquiries, type Inquiry } from "./data";
import {
  departments,
  departmentSuggestion,
  pressureLevels,
  rankDepartments,
  scorePercent,
  urgencyLevels,
} from "./triage";

export default function App() {
  const [model, setModel] = useState<JevModel>(DEFAULT_JEV_MODEL);
  const [runs, setRuns] = useState<{ inquiry: Inquiry; result: TriageResult }[]>([]);
  const [selectedId, setSelectedId] = useState(inquiries[0].id);
  const [results, setResults] = useState<Partial<Record<string, TriageResult>>>({});
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [pendingId, setPendingId] = useState<string>();
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const [threshold, setThreshold] = useState(0.8);
  const selected = inquiries.find((item) => item.id === selectedId)!;
  const keyFor = (id: string) => `${model}/${id}`;
  const result = results[keyFor(selectedId)];
  async function classify(items: Inquiry[]) {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    try {
      // Sequential requests keep the sample simple and avoid a burst of API calls.
      for (const item of items) {
        const key = keyFor(item.id);
        setPendingId(item.id);
        setErrors((previous) => ({ ...previous, [key]: "" }));
        try {
          const response = await fetch("/api/triage", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: item.id, model }),
            signal: AbortSignal.timeout(35_000),
          });
          if (!response.ok) {
            const data = (await response.json()) as { error: string };
            throw new Error(data.error);
          }
          const data = (await response.json()) as TriageResult;
          setResults((previous) => ({ ...previous, [key]: data }));
          setRuns((previous) => [...previous, { inquiry: item, result: data }]);
        } catch (error) {
          setErrors((previous) => ({
            ...previous,
            [key]:
              error instanceof Error ? error.message : "Classification failed. Please try again.",
          }));
          // Stop a batch on failure so a missing key or outage doesn't repeat requests.
          break;
        }
      }
    } finally {
      setPendingId(undefined);
      setBusy(false);
      running.current = false;
    }
  }

  return (
    <>
      <div className="toolbar">
        <label htmlFor="model">Jev model</label>
        <select
          id="model"
          value={model}
          disabled={busy}
          onChange={(event) => {
            if (isJevModel(event.target.value)) setModel(event.target.value);
          }}
        >
          {JEV_MODELS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <button
          disabled={!runs.length}
          onClick={() =>
            downloadJson("inquiry-results.json", {
              schema: 1,
              exportedAt: new Date().toISOString(),
              runs,
            })
          }
        >
          Download results JSON
        </button>
        <button
          disabled={busy}
          onClick={() => void classify(inquiries.filter((item) => !results[keyFor(item.id)]))}
        >
          Classify all pending inquiries
        </button>
      </div>
      <p className="note">
        Results are kept separately for each model until you reload the page. Download JSON to save
        all runs, including repeated classifications.
      </p>
      <div className="threshold">
        <label htmlFor="threshold">
          Department recommendation threshold: {Math.round(threshold * 100)}%
        </label>
        <input
          id="threshold"
          type="range"
          min="30"
          max="100"
          step="5"
          value={Math.round(threshold * 100)}
          onChange={(event) => setThreshold(Number(event.target.value) / 100)}
        />
        <small>
          Recommend a department at {Math.round(threshold * 100)}% confidence or above; otherwise,
          show the top two candidates. Show “Needs review” below 30% confidence or when the
          department is unknown.
        </small>
      </div>
      <output className="status">
        {busy
          ? `Classifying ${pendingId}…`
          : `${inquiries.length} inquiries · ${inquiries.filter((item) => results[keyFor(item.id)]).length} classified`}
      </output>

      <div className="workspace">
        <div className="table-scroll">
          <table>
            <caption className="sr-only">Inquiry list</caption>
            <thead>
              <tr>
                <th scope="col">Inquiry</th>
                <th scope="col">Urgency</th>
                <th scope="col">Request pressure</th>
                <th scope="col">Department</th>
              </tr>
            </thead>
            <tbody>
              {inquiries.map((item) => {
                const answer = results[keyFor(item.id)];
                return (
                  <tr
                    key={item.id}
                    className={selectedId === item.id ? "selected" : undefined}
                    onClick={() => setSelectedId(item.id)}
                  >
                    <td>
                      <button
                        className="ticket"
                        aria-pressed={selectedId === item.id}
                        onClick={() => setSelectedId(item.id)}
                      >
                        <small>{item.id}</small>
                        {item.title}
                      </button>
                      {pendingId === item.id && <small>Classifying…</small>}
                      {errors[keyFor(item.id)] && (
                        <small className="error">Classification failed: see details</small>
                      )}
                    </td>
                    <td>
                      {answer ? (
                        <Score value={scorePercent(answer.urgency.score, urgencyLevels)} />
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      {answer ? `${scorePercent(answer.pressure.score, pressureLevels)}/100` : "—"}
                    </td>
                    <td>
                      {answer
                        ? departmentSuggestion(answer.department, threshold)
                        : "Not classified"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <section className="detail" aria-labelledby="detail-title">
          <small>{selected.id}</small>
          <h2 id="detail-title">{selected.title}</h2>
          <p className="body">{selected.body}</p>
          <button disabled={busy} onClick={() => void classify([selected])}>
            {result ? "Classify again" : "Classify this inquiry"}
          </button>
          {errors[keyFor(selectedId)] && (
            <p role="alert" className="error">
              {errors[keyFor(selectedId)]}
              {result && " Showing the previous result."}
            </p>
          )}
          {result ? (
            <div className="result">
              <h3>Results</h3>
              <dl>
                <div>
                  <dt>Urgency</dt>
                  <dd>{scorePercent(result.urgency.score, urgencyLevels)}/100</dd>
                </div>
                <div>
                  <dt>Request pressure</dt>
                  <dd>{scorePercent(result.pressure.score, pressureLevels)}/100</dd>
                </div>
                <div>
                  <dt>Department</dt>
                  <dd>{departmentSuggestion(result.department, threshold)}</dd>
                </div>
                <div>
                  <dt>Department confidence</dt>
                  <dd>{Math.round(result.department.confidence * 100)}%</dd>
                </div>
              </dl>
              <h3>Department probabilities</h3>
              <ul className="probabilities">
                {rankDepartments(result.department).map(([department, value]) => (
                  <li key={department}>
                    <span>{departments[department]}</span>
                    <span>{(value * 100).toFixed(1)}%</span>
                  </li>
                ))}
              </ul>
              <p className="note">
                Candidate probabilities and overall confidence are separate values. Confidence does
                not guarantee a correct result.
              </p>
              <details>
                <summary>Urgency and request pressure breakdown</summary>
                {(
                  [
                    ["Urgency", result.urgency, urgencyLevels],
                    ["Request pressure", result.pressure, pressureLevels],
                  ] as const
                ).map(([label, answer, levels]) => (
                  <div key={label}>
                    <h3>
                      {label} (confidence {Math.round(answer.confidence * 100)}%)
                    </h3>
                    <ul>
                      {Object.entries(answer.probabilities).map(([score, probability]) => (
                        <li key={score}>
                          {levels[Number(score)]}: {(probability * 100).toFixed(1)}%
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </details>
              <small>
                Requested: {result.requestedModel}
                <br />
                Returned: {result.model ?? "Unavailable"}
                <br />
                {result.elapsed} ms · {result.usage.input_tokens ?? "—"} input tokens /{" "}
                {result.usage.output_tokens ?? "—"} output tokens
              </small>
            </div>
          ) : (
            <p className="note">
              Classify this inquiry to see urgency, request pressure, and department suggestions.
            </p>
          )}
        </section>
      </div>
    </>
  );
}

function Score({ value }: { value: number }) {
  return (
    <div className="score">
      <meter min="0" max="100" value={value} aria-label={`Urgency ${value}/100`} />
      <span>{value}/100</span>
    </div>
  );
}
