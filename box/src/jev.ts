import { readJevMetadata } from "@playground-jev/common";
import { z } from "zod";
import { answersSchema, MODEL, type BoxResult } from "./schema";

export function buildJevRequest(question: string, assetId: string) {
  return {
    model: MODEL,
    state: { photo: assetId, request: question },
    assets: { [assetId]: { type: "image", part: "photo" } },
    questions: {
      present: {
        type: "noul",
        instructions:
          "Is the specific target described or asked about in `request` visible in `photo`? Evaluate presence only.",
      },
      target: {
        type: "box",
        instructions:
          "Locate the single target described or asked about in `request` within `photo`. Follow any positional or descriptive qualifiers in the request.",
      },
    },
  };
}

export async function locate(file: File, question: string, apiKey: string): Promise<BoxResult> {
  const started = performance.now();
  const body = new FormData();
  body.append(
    "request",
    new Blob([JSON.stringify(buildJevRequest(question, crypto.randomUUID()))], {
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
  const { answers } = z.object({ answers: answersSchema }).parse(raw);
  return {
    ...answers,
    ...readJevMetadata(raw, MODEL),
    elapsed: Math.round(performance.now() - started),
  };
}
