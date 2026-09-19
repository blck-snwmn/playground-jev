import { z } from "zod";
import { answersSchema, type TriageResult } from "./schema";
import { context, type Inquiry } from "./data";
import { departments, departmentRoles, pressureLevels, urgencyLevels } from "./triage";

export function buildJevRequest(inquiry: Inquiry) {
  return {
    model: "jev-latest",
    state: {
      ...context,
      departments: Object.entries(departmentRoles)
        .filter(([id]) => id !== "unknown")
        .map(([id, role]) => ({ name: departments[id as keyof typeof departments], role })),
      inquiry: { title: inquiry.title, body: inquiry.body },
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

export async function classifyInquiry(inquiry: Inquiry, apiKey: string): Promise<TriageResult> {
  const started = performance.now();
  const response = await fetch("https://api.typesafe.ai/v1/systemone", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildJevRequest(inquiry)),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error("Jev request failed");
  const data = z.object({ answers: answersSchema }).parse(await response.json());
  return { ...data.answers, elapsed: Math.round(performance.now() - started) };
}
