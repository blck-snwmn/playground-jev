import { DEFAULT_JEV_MODEL, readJevMetadata, type JevModel } from "@playground-jev/common";
import { z } from "zod";
import { answersSchema, type TriageResult } from "./schema";
import { context, localizeInquiry, type Inquiry, type InquiryLanguage } from "./data";
import { departments, departmentRoles, pressureLevels, urgencyLevels } from "./triage";

export function buildJevRequest(
  inquiry: Inquiry,
  model: JevModel = DEFAULT_JEV_MODEL,
  language: InquiryLanguage = "en",
) {
  const localized = localizeInquiry(inquiry, language);
  return {
    model,
    state: {
      ...context,
      departments: Object.entries(departmentRoles)
        .filter(([id]) => id !== "unknown")
        .map(([id, role]) => ({ name: departments[id as keyof typeof departments], role })),
      inquiry: { title: localized.title, body: localized.body },
    },
    questions: {
      urgency: {
        type: "score",
        instructions: "Assess how urgently this inquiry needs to be addressed.",
        criteria: urgencyLevels,
      },
      pressure: {
        type: "score",
        instructions:
          "Assess how strongly the wording of this inquiry presses for a quick response.",
        criteria: pressureLevels,
      },
      department: {
        type: "choice",
        instructions: "Select the department responsible for handling this inquiry.",
        criteria: Object.fromEntries(
          Object.entries(departmentRoles).map(([id, role]) => [
            id,
            { name: departments[id as keyof typeof departments], role },
          ]),
        ),
      },
    },
  };
}

export async function classifyInquiry(
  inquiry: Inquiry,
  apiKey: string,
  model: JevModel = DEFAULT_JEV_MODEL,
  language: InquiryLanguage = "en",
): Promise<TriageResult> {
  const started = performance.now();
  const response = await fetch("https://api.typesafe.ai/v1/systemone", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildJevRequest(inquiry, model, language)),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error("Jev request failed");
  const raw: unknown = await response.json();
  const data = z.object({ answers: answersSchema }).parse(raw);
  return {
    ...data.answers,
    language,
    elapsed: Math.round(performance.now() - started),
    ...readJevMetadata(raw, model),
  };
}
