import { useEffect, useRef, useState } from "react";
import { prepareImage } from "./image";
import { newTarget, type TargetRow } from "./targets";
import {
  MAX_QUESTION_LENGTH,
  MAX_TARGETS,
  MODEL,
  PRESENCE_THRESHOLD,
  type BoxResult,
} from "./schema";

type Prepared = Awaited<ReturnType<typeof prepareImage>> & { url: string };
const percent = (value: number | null) =>
  value === null ? "Unknown" : `${(value * 100).toFixed(1)}%`;

export default function App() {
  const [image, setImage] = useState<Prepared | null>(null);
  const [rows, setRows] = useState<TargetRow[]>(() => [newTarget([])]);
  const [result, setResult] = useState<BoxResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState("");
  const selection = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(
    () => () => {
      if (image) URL.revokeObjectURL(image.url);
    },
    [image],
  );

  async function selectImage(file: File | undefined) {
    if (!file) return;
    const version = ++selection.current;
    setPreparing(true);
    setImage(null);
    setResult(null);
    setError("");
    try {
      const prepared = await prepareImage(file);
      if (selection.current === version)
        setImage({ ...prepared, url: URL.createObjectURL(prepared.file) });
    } catch (cause) {
      if (selection.current === version)
        setError(cause instanceof Error ? cause.message : "Could not load the image.");
    } finally {
      if (selection.current === version) setPreparing(false);
    }
  }

  function changeRows(next: TargetRow[]) {
    setRows(next);
    setResult(null);
    setError("");
  }

  const ready = rows.every((row) => row.question.trim().length > 0);
  async function run() {
    if (!image || !ready || busy || preparing) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const body = new FormData();
      body.append("image", image.file);
      body.append(
        "targets",
        JSON.stringify(rows.map(({ id, question }) => ({ id, question: question.trim() }))),
      );
      const response = await fetch("/api/locate", {
        method: "POST",
        body,
        signal: AbortSignal.timeout(65_000),
      });
      if (!response.ok) {
        const failure = (await response.json()) as { error?: string };
        throw new Error(failure.error ?? "The request failed. Please try again.");
      }
      setResult((await response.json()) as BoxResult);
    } catch (cause) {
      setError(
        cause instanceof Error && cause.name === "TimeoutError"
          ? "The request timed out. Please try again."
          : cause instanceof Error
            ? cause.message
            : "The request failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <header>
        <div className="brand-mark" aria-hidden="true">
          ⌗
        </div>
        <div>
          <h1>Find in image</h1>
          <p>Upload an image and describe what to find.</p>
        </div>
        <span className="model">Jev Box · 1.14</span>
      </header>
      <div className="workspace">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void run();
          }}
        >
          <label htmlFor="image">Image</label>
          <input
            id="image"
            ref={fileInput}
            hidden
            type="file"
            accept="image/png,image/jpeg"
            disabled={busy || preparing}
            onChange={(event) => {
              void selectImage(event.target.files?.[0]);
            }}
          />
          <div className="file-picker">
            <button
              type="button"
              className="choose-image"
              disabled={busy || preparing}
              onClick={() => fileInput.current?.click()}
            >
              Choose image
            </button>
            <span title={image?.name}>{image?.name ?? "No image selected"}</span>
          </div>
          <p className="hint">
            PNG or JPEG, up to 16 MiB. Images are resized and oriented before upload.
          </p>
          <div className="targets-heading">
            <h2>Questions</h2>
            <span>
              {rows.length} / {MAX_TARGETS}
            </span>
          </div>
          <div
            className="targets-scroll"
            role="region"
            aria-label="Questions and results"
            tabIndex={0}
          >
            <table className="targets-table">
              <colgroup>
                <col className="color-column" />
                <col />
                <col className="score-column" />
                <col className="score-column" />
                <col className="action-column" />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">
                    <span className="sr-only">Color</span>
                  </th>
                  <th scope="col">What to find</th>
                  <th scope="col">Confidence</th>
                  <th scope="col">Presence</th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const answer = result?.targets.find((target) => target.id === row.id);
                  return (
                    <tr className="target-row" key={row.id}>
                      <td>
                        <span
                          className="color-dot"
                          style={{ backgroundColor: row.color }}
                          aria-hidden="true"
                        />
                      </td>
                      <td>
                        <input
                          id={`question-${row.id}`}
                          type="text"
                          aria-label={`Question ${index + 1}`}
                          maxLength={MAX_QUESTION_LENGTH}
                          value={row.question}
                          disabled={busy}
                          placeholder="e.g. Where is the apple?"
                          onChange={(event) =>
                            changeRows(
                              rows.map((item) =>
                                item.id === row.id
                                  ? { ...item, question: event.target.value }
                                  : item,
                              ),
                            )
                          }
                        />
                      </td>
                      <td
                        className="score-cell"
                        aria-label={`Confidence for question ${index + 1}`}
                      >
                        {answer ? percent(answer.target.confidence) : "—"}
                      </td>
                      <td
                        className="score-cell"
                        aria-label={`Presence probability for question ${index + 1}`}
                      >
                        {answer ? percent(answer.present.noul) : "—"}
                      </td>
                      <td>
                        <button
                          className="remove-target"
                          type="button"
                          disabled={busy || rows.length === 1}
                          aria-label={`Remove question ${index + 1}`}
                          title="Remove question"
                          onClick={() => changeRows(rows.filter((item) => item.id !== row.id))}
                        >
                          −
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4} />
                  <td>
                    <button
                      className="add-target"
                      type="button"
                      disabled={busy || rows.length >= MAX_TARGETS}
                      aria-label="Add question"
                      title="Add question"
                      onClick={() => changeRows([...rows, newTarget(rows)])}
                    >
                      ＋
                    </button>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="hint">
            Up to 10 questions, one box per question. Dashed boxes indicate presence below 50%.
          </p>
          <button type="submit" disabled={!image || !ready || busy || preparing}>
            {busy ? "Finding…" : "Find objects"}
          </button>
          <p className="hint sending">Running sends the image and questions to Jev.</p>
          <div className="run-status">
            <div aria-live="polite" role="status">
              {preparing && <p>Preparing image…</p>}
              {busy && <p>Finding objects in the image.</p>}
              {result && (
                <p>
                  Displayed {result.targets.length} {result.targets.length === 1 ? "box" : "boxes"}.
                </p>
              )}
            </div>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
          </div>
          <details>
            <summary>Result details</summary>
            <div className="result-details-body">
              <dl>
                <div>
                  <dt>Elapsed time</dt>
                  <dd>{result ? `${(result.elapsed / 1000).toFixed(2)} s` : "—"}</dd>
                </div>
                <div>
                  <dt>Requested model</dt>
                  <dd>{MODEL}</dd>
                </div>
                <div>
                  <dt>Returned model</dt>
                  <dd>{result ? (result.model ?? "Unknown") : "—"}</dd>
                </div>
                <div>
                  <dt>Input tokens</dt>
                  <dd>{result ? (result.usage.input_tokens ?? "Unknown") : "—"}</dd>
                </div>
                <div>
                  <dt>Output tokens</dt>
                  <dd>{result ? (result.usage.output_tokens ?? "Unknown") : "—"}</dd>
                </div>
              </dl>
              <pre>
                {JSON.stringify(
                  result?.targets.map(({ question, target }) => ({ question, box: target.box })),
                  null,
                  2,
                )}
              </pre>
              <p className="hint">
                Coordinates range from 0 to 1 relative to image width and height. Dashed boxes
                indicate presence below 50%.
              </p>
            </div>
          </details>
        </form>
        <section className="preview" aria-label="Image preview" aria-busy={busy || preparing}>
          <div className="preview-heading">
            <h2>Preview</h2>
            <span>{image ? `${image.width} × ${image.height}` : "Select an image to preview"}</span>
          </div>
          <div className="canvas">
            {image ? (
              <div className="image-wrap" style={{ maxWidth: image.width }}>
                <img src={image.url} alt="Uploaded image" />
                {rows.map((row, index) => {
                  const answer = result?.targets.find((target) => target.id === row.id);
                  if (!answer) return null;
                  const box = answer.target.box;
                  return (
                    <div
                      key={row.id}
                      className="bounding-box"
                      aria-label={`Box for question ${index + 1}`}
                      style={{
                        borderColor: row.color,
                        borderStyle: answer.present.noul < PRESENCE_THRESHOLD ? "dashed" : "solid",
                        left: `${box.left * 100}%`,
                        top: `${box.top * 100}%`,
                        width: `${(box.right - box.left) * 100}%`,
                        height: `${(box.bottom - box.top) * 100}%`,
                      }}
                    >
                      <span className="box-number" style={{ backgroundColor: row.color }}>
                        {index + 1}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="empty">
                <svg width="80" height="64" viewBox="0 0 80 64" fill="none" aria-hidden="true">
                  <path
                    d="M20 4H4V20M60 4H76V20M4 44V60H20M60 60H76V44"
                    stroke="currentColor"
                    strokeWidth="3"
                  />
                  <circle cx="28" cy="23" r="5" fill="currentColor" />
                  <path d="M17 47L33 32L42 40L51 28L64 47H17Z" fill="currentColor" />
                </svg>
                <p>Choose an image to start</p>
                <span>Try a photo or screenshot.</span>
              </div>
            )}
          </div>
          {image && <p className="filename">{image.name}</p>}
        </section>
      </div>
      <footer>
        Image recognition and Box are experimental. Check the boxes against your image.
      </footer>
    </main>
  );
}
