import { readJevMetadata } from "@playground-jev/common";
import { z } from "zod";
import { answersSchema, MODEL, type TargetInput, type BoxResult } from "./schema";

export function buildJevRequest(targets: TargetInput[], assetId: string) {
  return {
    model: MODEL,
    state: {
      photo: assetId,
      requests: Object.fromEntries(
        targets.map((target, index) => [`item_${index}`, target.question]),
      ),
    },
    assets: { [assetId]: { type: "image", part: "photo" } },
    questions: Object.fromEntries(
      targets.flatMap((_, index) => [
        [
          `present_${index}`,
          {
            type: "noul",
            instructions: `Is the specific target described or asked about in \`requests.item_${index}\` visible in \`photo\`? Evaluate presence only.`,
          },
        ],
        [
          `target_${index}`,
          {
            type: "box",
            instructions: `Locate the single target described or asked about in \`requests.item_${index}\` within \`photo\`. Follow any positional or descriptive qualifiers in that request.`,
          },
        ],
      ]),
    ),
  };
}

export async function locate(
  file: File,
  targets: TargetInput[],
  apiKey: string,
): Promise<BoxResult> {
  const started = performance.now();
  const body = new FormData();
  body.append(
    "request",
    new Blob([JSON.stringify(buildJevRequest(targets, crypto.randomUUID()))], {
      type: "application/json",
    }),
  );
  body.append("photo", file);
  const response = await fetch("https://api.typesafe.ai/v1/systemone", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "TypeSafe-Danger-Zone-Images": "true" },
    body,
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error("Jev request failed");
  const raw: unknown = await response.json();
  const { answers } = z.object({ answers: z.record(z.string(), z.unknown()) }).parse(raw);
  return {
    targets: targets.map((target, index) => ({
      ...target,
      ...answersSchema.parse({
        present: answers[`present_${index}`],
        target: answers[`target_${index}`],
      }),
    })),
    ...readJevMetadata(raw, MODEL),
    elapsed: Math.round(performance.now() - started),
  };
}
