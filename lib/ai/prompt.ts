import type { TripFacts } from './facts';

// AI-1 (US-F1 / AC-F1.1): assemble the advice prompt from engine facts. PURE —
// it only formats the already-computed facts into the instruction the model
// receives; it performs no time math of its own (that is the engine's job).
export function buildAdvicePrompt(facts: TripFacts): string {
  const deltaHours = facts.offsetDeltaMinutes / 60;
  const direction = facts.offsetDeltaMinutes >= 0 ? 'ahead of' : 'behind';
  const sleepLines = facts.sleepWindows.length
    ? facts.sleepWindows
        .map((w) => `- ${w.startUtc} to ${w.endUtc} UTC (${w.label})`)
        .join('\n')
    : '- none recommended';

  return [
    'You are a jetlag-adjustment coach. Using only the facts below, write a personalized plan.',
    '',
    `Origin time zone: ${facts.originZone}`,
    `Destination time zone: ${facts.destinationZone}`,
    `Time zone shift: ${facts.offsetDeltaMinutes} minutes (${deltaHours.toFixed(1)}h ${direction} origin).`,
    `Crosses the International Date Line: ${facts.crossesDateLine ? 'yes' : 'no'}.`,
    '',
    'Recommended in-flight sleep windows:',
    sleepLines,
    '',
    'Respond as JSON: { "summary": string, "preFlight": string[], "inFlight": string[], "postArrival": string[] }.',
  ].join('\n');
}
