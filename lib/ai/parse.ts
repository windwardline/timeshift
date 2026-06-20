// AI-2/AI-3 (US-F1 / AC-F1.2, AC-F1.3): parse the model's structured response
// into a validated AdvicePlan. PURE.

export interface AdvicePlan {
  summary: string;
  preFlight: string[];
  inFlight: string[];
  postArrival: string[];
}

export function parseAdviceResponse(raw: string): AdvicePlan {
  // Red stub: a placeholder so the happy-path test fails on assertion, not on a
  // missing import. Replaced with real parse + validation in Green.
  void raw;
  return { summary: '', preFlight: [], inFlight: [], postArrival: [] };
}
