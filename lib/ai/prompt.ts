import type { TripFacts } from './facts';
import type { ScoredChunk } from '@/lib/rag/types';

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

// US-R (AC-R1/R2/R3): assemble the grounded coach prompt from retrieved KB
// chunks. PURE — it only formats the already-retrieved context and the question.
// Each chunk is labelled with its source doc so the model's answer cites real
// docs, and the grounding instruction forces a refusal when the context does not
// cover the question (no fabrication beyond the supplied context).
export function buildGroundedPrompt(query: string, chunks: ScoredChunk[]): string {
  const context = chunks
    .map((c) => `[Source: ${c.docId} — ${c.heading}]\n${c.text}`)
    .join('\n\n');

  return [
    'You are TimeShift’s jetlag coach. Answer the traveler’s question using ONLY',
    'the context below. If the context does not cover the question, say you don’t',
    'have that in your knowledge base rather than guessing. Do not use outside',
    'knowledge and do not invent sources.',
    '',
    'After answering, add a "followUp": one or two sentences pointing the traveler',
    'to the single most logical next step or next question to consider — also',
    'grounded in the context above, not invented.',
    '',
    'Context:',
    context,
    '',
    `Question: ${query}`,
    '',
    'Respond as JSON: { "answer": string, "followUp": string }.',
  ].join('\n');
}
