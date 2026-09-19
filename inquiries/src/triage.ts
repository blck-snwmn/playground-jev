import type { DepartmentAnswer } from "./schema";

type Department = DepartmentAnswer["choice"];

export const departments = {
  support: "Support",
  engineering: "Engineering",
  billing: "Finance (Billing & Payments)",
  sales: "Sales",
  product: "Product Management",
  success: "Customer Success",
  unknown: "Insufficient information / Unknown department",
} satisfies Record<Department, string>;

export const departmentRoles: Record<Department, string> = {
  support:
    "Receives customer inquiries, explains usage, settings, and specifications, gathers details, and performs initial triage. Serves as the point of contact for customers.",
  engineering:
    "Designs, implements, maintains, and operates the service. Investigates technical issues in systems and data, fixes defects, and maintains reliability.",
  billing:
    "Issues and corrects invoices, reconciles payments, and processes refunds for the company’s SaaS subscription fees.",
  sales:
    "Handles proposals, quotes, pricing and contract discussions, signing and renewing contracts, and expanding subscriptions.",
  product:
    "Gathers customer problems and requests, and considers product specifications, feature direction, and development priorities.",
  success:
    "Helps customer companies onboard, adopt, and use the service in their operations. Supports workflow design and rollout across teams.",
  unknown: "The responsible department cannot be determined.",
};

// Score values are positions on these scales, not probabilities of urgency.
export const urgencyLevels = [
  "Can wait in the normal queue, with little impact from a delayed response.",
  "A timely response is desirable, but there is some time to spare.",
  "A delayed response would have significant impact; prompt action is needed.",
  "Cannot wait for a response; immediate action is needed.",
];

export const pressureLevels = [
  "Explicitly says there is no rush or that a response can wait until convenient.",
  "A routine request with no wording that pushes for a faster response.",
  "Asks for a timely response without demanding immediate action.",
  "Strongly demands immediate action with wording such as urgently, right now, or hurry.",
];

export function scorePercent(score: number, levels: string[]): number {
  return Math.round((score / (levels.length - 1)) * 100);
}

export function rankDepartments(answer: DepartmentAnswer) {
  return Object.entries(answer.probabilities).sort((a, b) => b[1] - a[1]) as [Department, number][];
}

// Illustrative display policy only; never assigns a ticket to a department.
export function departmentSuggestion(answer: DepartmentAnswer, threshold: number) {
  if (answer.choice === "unknown" || answer.confidence < 0.3) {
    return "Needs review";
  }
  if (answer.confidence >= threshold) {
    return `Recommended: ${departments[answer.choice]}`;
  }
  const candidates = rankDepartments(answer)
    .filter(([department]) => department !== "unknown")
    .slice(0, 2)
    .map(([department]) => departments[department]);
  return `Candidates: ${candidates.join(", ")}`;
}
