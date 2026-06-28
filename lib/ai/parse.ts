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

// Typed failure for a malformed or non-conforming model response (AC-F1.3), so
// callers never see a generic SyntaxError/ZodError and never a half-built plan.
export class AdviceParseError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'AdviceParseError';
  }
}

export function parseAdviceResponse(raw: string): AdvicePlan {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (cause) {
    throw new AdviceParseError('Advice response was not valid JSON', { cause });
  }

  const result = advicePlanSchema.safeParse(json);
  if (!result.success) {
    throw new AdviceParseError('Advice response did not match the expected shape', {
      cause: result.error,
    });
  }
  return result.data;
}

// US-R (AC-R1): the grounded coach answer. Mirrors parseAdviceResponse — same
// typed AdviceParseError on malformed input, so a bad model response never leaks
// a raw SyntaxError/ZodError. The answer is trimmed of surrounding whitespace.
const groundedAnswerSchema = z.object({ answer: z.string() });

export type GroundedAnswer = z.infer<typeof groundedAnswerSchema>;

export function parseGroundedResponse(raw: string): GroundedAnswer {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (cause) {
    throw new AdviceParseError('Grounded response was not valid JSON', { cause });
  }

  const result = groundedAnswerSchema.safeParse(json);
  if (!result.success) {
    throw new AdviceParseError('Grounded response did not match the expected shape', {
      cause: result.error,
    });
  }
  return { answer: result.data.answer.trim() };
}
