import { z } from "zod";
import type { JevMetadata } from "@playground-jev/common";

export const MODEL = "jev-1.14.0";
export const MAX_IMAGE_BYTES = 16 * 1024 * 1024;
export const MAX_QUESTION_LENGTH = 1000;
export const MAX_TARGETS = 10;
export const targetsSchema = z
  .array(
    z.object({
      id: z.string().uuid(),
      question: z.string().trim().min(1).max(MAX_QUESTION_LENGTH),
    }),
  )
  .min(1)
  .max(MAX_TARGETS)
  .refine((targets) => new Set(targets.map((target) => target.id)).size === targets.length);
export type TargetInput = z.infer<typeof targetsSchema>[number];
export const MIN_SIDE = 280;
export const MAX_SIDE = 1568;
// A display policy for this prototype, not a vendor-recommended threshold.
export const PRESENCE_THRESHOLD = 0.5;
const probability = z.number().min(0).max(1);
export const coordinatesSchema = z
  .object({
    top: probability,
    bottom: probability,
    left: probability,
    right: probability,
  })
  .refine((box) => box.left < box.right && box.top < box.bottom);
export const answersSchema = z.object({
  present: z.object({ type: z.literal("noul"), noul: probability }),
  target: z.object({
    type: z.literal("box"),
    box: coordinatesSchema,
    confidence: probability.nullable(),
  }),
});
export type TargetResult = z.infer<typeof answersSchema> & TargetInput;
export type BoxResult = JevMetadata & { elapsed: number; targets: TargetResult[] };
