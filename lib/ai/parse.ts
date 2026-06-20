import { z } from 'zod';

// AI-2/AI-3 (US-F1 / AC-F1.2, AC-F1.3): parse the model's structured response
// into a validated AdvicePlan. PURE.

const advicePlanSchema = z.object({
  summary: z.string(),
  preFlight: z.array(z.string()),
  inFlight: z.array(z.string()),
  postArrival: z.array(z.string()),
});

export type AdvicePlan = z.infer<typeof advicePlanSchema>;

export function parseAdviceResponse(raw: string): AdvicePlan {
  return advicePlanSchema.parse(JSON.parse(raw));
}
