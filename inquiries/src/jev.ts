import { z } from "zod";
import { context, type Inquiry } from "./data";
import {
  departments,
  departmentRoles,
  pressureLevels,
  urgencyLevels,
  type TriageResult,
} from "./triage";

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

const probability = z.number().min(0).max(1);
const score = z.object({
  score: z.number().min(0).max(3),
  confidence: probability,
  probabilities: z.object({
    "0": probability,
    "1": probability,
    "2": probability,
    "3": probability,
  }),
});

export const answersSchema = z.object({
  urgency: score,
  pressure: score,
  department: z.object({
    choice: z.enum(["support", "engineering", "billing", "sales", "product", "success", "unknown"]),
    confidence: probability,
    probabilities: z.object({
      support: probability,
      engineering: probability,
      billing: probability,
      sales: probability,
      product: probability,
      success: probability,
      unknown: probability,
    }),
  }),
});

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
