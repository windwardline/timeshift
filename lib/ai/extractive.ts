// Keyless / live-failure fallback for the grounded coach (US-R, CLAUDE.md §13).
// Builds a { answer, followUp } purely from the retrieved passages already
// embedded in the grounded prompt's Context block — no model call, fully
// deterministic, so the coach answers (grounded) even with no key or a failed
// provider call. The Sources (the real grounding proof) are identical either
// way; the live model only upgrades the prose.
export function extractiveResponse(prompt: string): { answer: string; followUp: string } {
  const context = prompt.split('Context:\n')[1]?.split('\n\nQuestion:')[0] ?? '';
  const blocks = context
    .split('\n\n')
    .map((block) => ({
      heading: /—\s*([^\]]+)\]/.exec(block)?.[1]?.trim() ?? '',
      text: block.replace(/^\[Source:[^\]]*\]\n?/, '').trim(),
    }))
    .filter((b) => b.text);

  const answer = blocks.length
    ? `From TimeShift's jetlag knowledge base: ${blocks.slice(0, 2).map((b) => b.text).join(' ')}`
    : '';
  // Point at a later retrieved topic with a meaningful heading (skip intro/empty).
  const next = blocks.slice(1).find((b) => b.heading && b.heading.toLowerCase() !== 'intro');
  const followUp = next ? `A natural next step: consider “${next.heading}.”` : '';
  return { answer, followUp };
}
