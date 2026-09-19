import { z } from "zod";

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

type Answers = z.infer<typeof answersSchema>;

export type DepartmentAnswer = Answers["department"];
export type TriageResult = Answers & { elapsed: number };
