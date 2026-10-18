import type { ReactNode } from "react";
import { conditions, resultKey, type Condition, type Results } from "./comparison";
import { languageNames } from "./data";
import type { TriageResult } from "./schema";
import {
  departments,
  departmentSuggestion,
  pressureLevels,
  rankDepartments,
  scorePercent,
  urgencyLevels,
} from "./triage";

interface Props {
  inquiryId: string;
  results: Results;
  errors: Partial<Record<string, string>>;
  pendingKey: string | undefined;
  busy: boolean;
  threshold: number;
  classify: (condition: Condition) => void;
}

export function Comparison({
  inquiryId,
  results,
  errors,
  pendingKey,
  busy,
  threshold,
  classify,
}: Props) {
  const rows: { label: string; render: (result: TriageResult) => ReactNode }[] = [
    {
      label: "Urgency",
      render: (r) => (
        <Score value={r.urgency.score} confidence={r.urgency.confidence} levels={urgencyLevels} />
      ),
    },
    {
      label: "Request pressure",
      render: (r) => (
        <Score
          value={r.pressure.score}
          confidence={r.pressure.confidence}
          levels={pressureLevels}
        />
      ),
    },
    {
      label: "Department",
      render: (r) => (
        <>
          {departments[r.department.choice]}
          <small>{Math.round(r.department.confidence * 100)}% confidence</small>
          <small>{departmentSuggestion(r.department, threshold)}</small>
        </>
      ),
    },
    {
      label: "Returned model",
      render: (r) => (
        <>
          {r.model ?? "Unavailable"}
          {r.model && r.model !== r.requestedModel && (
            <small className="error">Differs from requested model</small>
          )}
        </>
      ),
    },
    { label: "Elapsed", render: (r) => `${r.elapsed} ms` },
    {
      label: "Tokens (in / out)",
      render: (r) => `${r.usage.input_tokens ?? "—"} / ${r.usage.output_tokens ?? "—"}`,
    },
    {
      label: "Recorded",
      render: (r) => <time dateTime={r.recordedAt}>{new Date(r.recordedAt).toLocaleString()}</time>,
    },
    { label: "Distributions", render: (r) => <Distributions result={r} /> },
  ];
  return (
    <div className="table-scroll" role="region" aria-label="Four-condition comparison" tabIndex={0}>
      <table className="comparison">
        <caption>{inquiryId}: latest successful result for each model and language</caption>
        <thead>
          <tr>
            <th scope="col">
              Requested model
              <br />
              Inquiry language
            </th>
            {conditions.map((condition) => (
              <th scope="col" key={resultKey(inquiryId, condition)}>
                {condition.model}
                <br />
                <span lang={condition.language}>{languageNames[condition.language]}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">Status</th>
            {conditions.map((condition) => {
              const key = resultKey(inquiryId, condition);
              const result = results[key];
              return (
                <td key={key}>
                  {pendingKey === key
                    ? "Classifying…"
                    : errors[key]
                      ? "Failed"
                      : result
                        ? "Completed"
                        : "Not run"}
                  {result && (pendingKey === key || errors[key]) && (
                    <small>Showing previous result.</small>
                  )}
                  {errors[key] && (
                    <small className="error" role="alert">
                      {errors[key]}
                    </small>
                  )}
                </td>
              );
            })}
          </tr>
          {rows.map(({ label, render }) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              {conditions.map((condition) => {
                const key = resultKey(inquiryId, condition);
                return <td key={key}>{results[key] ? render(results[key]) : "—"}</td>;
              })}
            </tr>
          ))}
          <tr>
            <th scope="row">Run separately</th>
            {conditions.map((condition) => {
              const key = resultKey(inquiryId, condition);
              const action = results[key] ? "Classify again" : "Classify";
              return (
                <td key={key}>
                  <button
                    disabled={busy}
                    onClick={() => classify(condition)}
                    aria-label={`${action}: ${condition.model}, ${languageNames[condition.language]}`}
                  >
                    {action}
                  </button>
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function Score({
  value,
  confidence,
  levels,
}: {
  value: number;
  confidence: number;
  levels: string[];
}) {
  return (
    <>
      {scorePercent(value, levels)}/100<small>{Math.round(confidence * 100)}% confidence</small>
    </>
  );
}

function Distributions({ result }: { result: TriageResult }) {
  return (
    <details>
      <summary>Show probabilities</summary>
      <h3>Department</h3>
      <ul className="probabilities">
        {rankDepartments(result.department).map(([department, value]) => (
          <li key={department}>
            <span>{departments[department]}</span>
            <span>{(value * 100).toFixed(1)}%</span>
          </li>
        ))}
      </ul>
      {(
        [
          ["Urgency", result.urgency, urgencyLevels],
          ["Request pressure", result.pressure, pressureLevels],
        ] as const
      ).map(([label, answer, levels]) => (
        <div key={label}>
          <h3>{label}</h3>
          <ul className="probabilities">
            {Object.entries(answer.probabilities).map(([level, probability]) => (
              <li key={level}>
                <span>{levels[Number(level)]}</span>
                <span>{(probability * 100).toFixed(1)}%</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </details>
  );
}
