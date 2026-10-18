import { JEV_MODELS, type JevModel } from "@playground-jev/common";
import { INQUIRY_LANGUAGES, type Inquiry, type InquiryLanguage } from "./data";
import type { TriageResult } from "./schema";

export interface Condition {
  model: JevModel;
  language: InquiryLanguage;
}
export interface Evaluation extends Condition {
  inquiry: Inquiry;
}
export type Results = Partial<Record<string, TriageResult>>;
export const conditions: Condition[] = JEV_MODELS.flatMap((model) =>
  INQUIRY_LANGUAGES.map((language) => ({ model, language })),
);

export function resultKey(id: string, condition: Condition): string {
  return `${id}/${condition.model}/${condition.language}`;
}

export function pendingComparisons(inquiry: Inquiry, results: Results): Evaluation[] {
  return conditions
    .filter((condition) => !results[resultKey(inquiry.id, condition)])
    .map((condition) => ({ inquiry, ...condition }));
}
