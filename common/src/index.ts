export const JEV_MODELS = ["jev-1.13.0", "jev-1.14.0"] as const;
export type JevModel = (typeof JEV_MODELS)[number];
export const DEFAULT_JEV_MODEL: JevModel = JEV_MODELS[0];

export function isJevModel(value: unknown): value is JevModel {
  return JEV_MODELS.some((model) => model === value);
}

export interface JevMetadata {
  requestedModel: string;
  model: string | null;
  usage: { input_tokens: number | null; output_tokens: number | null };
  recordedAt: string;
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function tokenCount(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

/** Missing upstream metadata stays unknown, never inferred from the request. */
export function readJevMetadata(value: unknown, requestedModel: string): JevMetadata {
  const response = record(value);
  const usage = record(response.usage);
  return {
    requestedModel,
    model: typeof response.model === "string" && response.model.length > 0 ? response.model : null,
    usage: {
      input_tokens: tokenCount(usage.input_tokens),
      output_tokens: tokenCount(usage.output_tokens),
    },
    recordedAt: new Date().toISOString(),
  };
}

export function readChoiceDetails(value: unknown) {
  const answer = record(value);
  const isProbability = (p: unknown): p is number =>
    typeof p === "number" && Number.isFinite(p) && p >= 0 && p <= 1;
  const probabilities = Object.fromEntries(
    Object.entries(record(answer.probabilities)).filter((entry): entry is [string, number] =>
      isProbability(entry[1]),
    ),
  );
  return {
    confidence: isProbability(answer.confidence) ? answer.confidence : null,
    probabilities,
  };
}

export function downloadJson(filename: string, value: unknown): void {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
