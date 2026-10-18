import { useEffect, useRef, useState } from "react";
import { prepareImage } from "./image";
import { MAX_QUESTION_LENGTH, MODEL, PRESENCE_THRESHOLD, type BoxResult } from "./schema";

type Prepared = Awaited<ReturnType<typeof prepareImage>> & { url: string };
const percent = (value: number | null) =>
  value === null ? "不明" : `${(value * 100).toFixed(1)}%`;

export default function App() {
  const [image, setImage] = useState<Prepared | null>(null);
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<BoxResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState("");
  const selection = useRef(0);
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
        setError(cause instanceof Error ? cause.message : "画像を読み込めませんでした。");
    } finally {
      if (selection.current === version) setPreparing(false);
    }
  }

  async function run() {
    if (!image || !question.trim() || busy) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const body = new FormData();
      body.append("image", image.file);
      body.append("question", question.trim());
      const response = await fetch("/api/locate", {
        method: "POST",
        body,
        signal: AbortSignal.timeout(65_000),
      });
      if (!response.ok) {
        const failure = (await response.json()) as { error?: string };
        throw new Error(failure.error ?? "処理に失敗しました。再実行してください。");
      }
      setResult((await response.json()) as BoxResult);
    } catch (cause) {
      setError(
        cause instanceof Error && cause.name === "TimeoutError"
          ? "処理がタイムアウトしました。再実行してください。"
          : cause instanceof Error
            ? cause.message
            : "処理に失敗しました。",
      );
    } finally {
      setBusy(false);
    }
  }

  const showBox = result !== null && result.present.noul >= PRESENCE_THRESHOLD;
  const box = showBox ? result.target.box : null;
  return (
    <main>
      <header>
        <div className="brand-mark" aria-hidden="true">
          ⌗
        </div>
        <div>
          <h1>画像の中を探す</h1>
          <p>画像と質問から、探したいものを枠で囲みます。</p>
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
          <label htmlFor="image">画像</label>
          <input
            id="image"
            type="file"
            accept="image/png,image/jpeg"
            disabled={busy || preparing}
            onChange={(event) => {
              void selectImage(event.target.files?.[0]);
            }}
          />
          <p className="hint">PNG / JPEG、16 MiBまで。画像は送信前にサイズと向きを調整します。</p>
          <label htmlFor="question">質問・探したいもの</label>
          <textarea
            id="question"
            rows={5}
            maxLength={MAX_QUESTION_LENGTH}
            value={question}
            disabled={busy}
            placeholder="例：一番左のりんごはどこ？"
            onChange={(event) => {
              setQuestion(event.target.value);
              setResult(null);
              setError("");
            }}
          />
          <p className="hint">
            一度に囲めるのは1つです。複数ある場合は、位置や特徴を指定してください。
          </p>
          <button type="submit" disabled={!image || !question.trim() || busy || preparing}>
            {busy ? "探しています…" : "枠で囲む"}
          </button>
          <p className="hint sending">実行すると、画像と質問文をJevに送信します。</p>
          <div aria-live="polite" role="status">
            {preparing && <p>画像を準備しています…</p>}
            {busy && <p>画像の中から対象を探しています。</p>}
            {result && (
              <div className="result">
                <h2>{showBox ? "対象の位置を表示しました" : "対象の存在を確認できませんでした"}</h2>
                {!showBox && <p>存在確率が50%未満のため、枠を表示していません。</p>}
                <dl>
                  <div>
                    <dt>存在確率</dt>
                    <dd>{percent(result.present.noul)}</dd>
                  </div>
                  <div>
                    <dt>枠のconfidence</dt>
                    <dd>{percent(result.target.confidence)}</dd>
                  </div>
                </dl>
              </div>
            )}
          </div>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {result && (
            <details>
              <summary>結果の詳細</summary>
              <dl>
                <div>
                  <dt>処理時間</dt>
                  <dd>{(result.elapsed / 1000).toFixed(2)} 秒</dd>
                </div>
                <div>
                  <dt>要求モデル</dt>
                  <dd>{MODEL}</dd>
                </div>
                <div>
                  <dt>応答モデル</dt>
                  <dd>{result.model ?? "不明"}</dd>
                </div>
                <div>
                  <dt>入力トークン</dt>
                  <dd>{result.usage.input_tokens ?? "不明"}</dd>
                </div>
                <div>
                  <dt>出力トークン</dt>
                  <dd>{result.usage.output_tokens ?? "不明"}</dd>
                </div>
              </dl>
              <pre>{JSON.stringify(result.target.box, null, 2)}</pre>
              <p className="hint">
                座標は画像の幅・高さに対する0〜1の割合です。枠の表示基準は存在確率50%以上です。
              </p>
            </details>
          )}
        </form>
        <section className="preview" aria-label="画像プレビュー" aria-busy={busy || preparing}>
          <div className="preview-heading">
            <h2>プレビュー</h2>
            <span>
              {image ? `${image.width} × ${image.height}` : "画像を選ぶとここに表示されます"}
            </span>
          </div>
          <div className="canvas">
            {image ? (
              <div className="image-wrap" style={{ maxWidth: image.width }}>
                <img src={image.url} alt="位置を探す対象の画像" />
                {box && (
                  <div
                    className="bounding-box"
                    aria-label="検出した対象の枠"
                    style={{
                      left: `${box.left * 100}%`,
                      top: `${box.top * 100}%`,
                      width: `${(box.right - box.left) * 100}%`,
                      height: `${(box.bottom - box.top) * 100}%`,
                    }}
                  />
                )}
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
                <p>まずは画像を選んでください</p>
                <span>写真やスクリーンショットで試せます。</span>
              </div>
            )}
          </div>
          {image && <p className="filename">{image.name}</p>}
        </section>
      </div>
      <footer>画像認識とBoxは実験機能です。枠の位置は画像と照らし合わせて確認してください。</footer>
    </main>
  );
}
