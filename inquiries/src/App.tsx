import {
  DEFAULT_JEV_MODEL,
  JEV_MODELS,
  isJevModel,
  downloadJson,
  type JevModel,
} from "@playground-jev/common";
import { useRef, useState } from "react";
import type { TriageResult } from "./schema";
import {
  INQUIRY_LANGUAGES,
  inquiries,
  isInquiryLanguage,
  languageNames,
  localizeInquiry,
  type Inquiry,
  type InquiryId,
  type InquiryLanguage,
} from "./data";
import {
  conditions,
  pendingComparisons,
  resultKey,
  type Evaluation,
  type Results,
} from "./comparison";
import { Comparison } from "./ComparisonTable";
import { departmentSuggestion, pressureLevels, scorePercent, urgencyLevels } from "./triage";

export default function App() {
  const [model, setModel] = useState<JevModel>(DEFAULT_JEV_MODEL);
  const [language, setLanguage] = useState<InquiryLanguage>("en");
  const [runs, setRuns] = useState<{ inquiry: Inquiry; result: TriageResult }[]>([]);
  const [selectedId, setSelectedId] = useState<InquiryId>(inquiries[0].id);
  const [results, setResults] = useState<Results>({});
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [pending, setPending] = useState<Evaluation>();
  const [busy, setBusy] = useState(false);
  const [batchStatus, setBatchStatus] = useState("");
  const running = useRef(false);
  const [threshold, setThreshold] = useState(0.8);
  const selected = inquiries.find((item) => item.id === selectedId)!;
  const condition = { model, language };
  const pendingKey = pending ? resultKey(pending.inquiry.id, pending) : undefined;
  const missing = pendingComparisons(selected, results);
  const pendingInquiries = inquiries.filter((item) => !results[resultKey(item.id, condition)]);

  async function classify(evaluations: Evaluation[]) {
    if (running.current || !evaluations.length) return;
    running.current = true;
    setBusy(true);
    setBatchStatus("");
    let completed = 0;
    try {
      // Sequential calls avoid bursts; one failure stops the rest of the batch.
      for (const evaluation of evaluations) {
        const { inquiry, model, language } = evaluation;
        const key = resultKey(inquiry.id, evaluation);
        setPending(evaluation);
        setErrors((previous) => ({ ...previous, [key]: "" }));
        try {
          const response = await fetch("/api/triage", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: inquiry.id, model, language }),
            signal: AbortSignal.timeout(35_000),
          });
          if (!response.ok) {
            const data = (await response.json()) as { error: string };
            throw new Error(data.error);
          }
          const data = (await response.json()) as TriageResult;
          setResults((previous) => ({ ...previous, [key]: data }));
          setRuns((previous) => [
            ...previous,
            { inquiry: localizeInquiry(inquiry, language), result: data },
          ]);
          completed++;
        } catch (error) {
          setErrors((previous) => ({
            ...previous,
            [key]:
              error instanceof Error ? error.message : "Classification failed. Please try again.",
          }));
          setBatchStatus(
            `Stopped at ${inquiry.id}, ${model}, ${languageNames[language]}. ${completed} completed; ${evaluations.length - completed - 1} not attempted.`,
          );
          return;
        }
      }
      setBatchStatus(`${completed} ${completed === 1 ? "request" : "requests"} completed.`);
    } finally {
      setPending(undefined);
      setBusy(false);
      running.current = false;
    }
  }

  return (
    <>
      <div className="toolbar">
        <label htmlFor="inquiry">Inquiry</label>
        <select
          id="inquiry"
          value={selectedId}
          disabled={busy}
          onChange={(event) => {
            const inquiry = inquiries.find((item) => item.id === event.target.value);
            if (inquiry) setSelectedId(inquiry.id);
          }}
        >
          {inquiries.map((item) => (
            <option key={item.id} value={item.id}>
              {item.id} — {item.title}
            </option>
          ))}
        </select>
        <button
          disabled={!runs.length}
          onClick={() =>
            downloadJson("inquiry-results.json", {
              schema: 2,
              exportedAt: new Date().toISOString(),
              runs,
            })
          }
        >
          Download results JSON
        </button>
      </div>
      <div className="inquiry-texts">
        {INQUIRY_LANGUAGES.map((language) => {
          const inquiry = localizeInquiry(selected, language);
          return (
            <article lang={language} key={language}>
              <small>{languageNames[language]}</small>
              <h2>{inquiry.title}</h2>
              <p>{inquiry.body}</p>
            </article>
          );
        })}
      </div>
      <p className="note">
        Only the inquiry title and body change language. Service context, questions, and scoring
        scales stay in English.
      </p>
      <div className="toolbar">
        <button disabled={busy || !missing.length} onClick={() => void classify(missing)}>
          Run missing conditions ({missing.length} {missing.length === 1 ? "request" : "requests"})
        </button>
        <button
          disabled={busy || missing.length === conditions.length}
          onClick={() =>
            void classify(conditions.map((condition) => ({ inquiry: selected, ...condition })))
          }
        >
          Run all 4 again
        </button>
      </div>
      <output className="status" aria-live="polite">
        {pending
          ? `Classifying ${pending.inquiry.id}, ${pending.model}, ${languageNames[pending.language]}…`
          : batchStatus || "Choose a condition or run the four-condition comparison."}
      </output>
      <Comparison
        key={selectedId}
        inquiryId={selectedId}
        results={results}
        errors={errors}
        pendingKey={pendingKey}
        busy={busy}
        threshold={threshold}
        classify={(condition) => void classify([{ inquiry: selected, ...condition }])}
      />
      <p className="note comparison-note">
        Scores show positions on a 0–100 scale, not probabilities of urgency or pressure. Confidence
        is calculated from the probability distribution; it is not an accuracy score. Scroll the
        table horizontally on a narrow screen.
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
      <p className="note">
        Each column keeps its latest successful result until reload. Download JSON to save all
        successful runs, including reruns, their language, and the text evaluated. These samples
        have no reference labels; differences alone do not establish which model is more accurate.
      </p>
      <details className="overview">
        <summary>All 12 inquiries</summary>
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
            {JEV_MODELS.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
          <label htmlFor="language">Inquiry language</label>
          <select
            id="language"
            value={language}
            disabled={busy}
            onChange={(event) => {
              if (isInquiryLanguage(event.target.value)) setLanguage(event.target.value);
            }}
          >
            {INQUIRY_LANGUAGES.map((language) => (
              <option key={language} value={language}>
                {languageNames[language]}
              </option>
            ))}
          </select>
          <button
            disabled={busy || !pendingInquiries.length}
            onClick={() =>
              void classify(pendingInquiries.map((inquiry) => ({ inquiry, ...condition })))
            }
          >
            Classify pending inquiries ({pendingInquiries.length}{" "}
            {pendingInquiries.length === 1 ? "request" : "requests"})
          </button>
        </div>
        <div className="table-scroll">
          <table className="inquiry-list">
            <caption>
              {model}, {languageNames[language]}: {inquiries.length - pendingInquiries.length} of{" "}
              {inquiries.length} classified
            </caption>
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
                const key = resultKey(item.id, condition);
                const answer = results[key];
                return (
                  <tr key={item.id} className={selectedId === item.id ? "selected" : undefined}>
                    <td>
                      <button
                        className="ticket"
                        disabled={busy}
                        aria-pressed={selectedId === item.id}
                        onClick={() => {
                          setSelectedId(item.id);
                          document.getElementById("inquiry")?.focus();
                        }}
                      >
                        <small>{item.id}</small>
                        <span lang={language}>{localizeInquiry(item, language).title}</span>
                      </button>
                      {pendingKey === key && <small>Classifying…</small>}
                      {errors[key] && (
                        <small className="error">
                          Classification failed. Open this inquiry to see details.
                          {answer && " Showing previous result."}
                        </small>
                      )}
                    </td>
                    <td>
                      {answer ? `${scorePercent(answer.urgency.score, urgencyLevels)}/100` : "—"}
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
      </details>
    </>
  );
}
