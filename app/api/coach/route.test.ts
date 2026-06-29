import { describe, it, expect, beforeEach, vi } from 'vitest';

// POST /api/coach (US-R): validates the question, then delegates to the grounded
// orchestrator. answerQuestion + the corpus/embedder/client deps are mocked, so
// the route's own job — Zod validation and JSON shaping — is what is under test.
const mocks = vi.hoisted(() => ({
  answerQuestion: vi.fn(),
  loadCorpus: vi.fn(),
  embedQuery: vi.fn(),
}));

vi.mock('@/lib/ai/coach', async (orig) => ({
  ...(await orig<typeof import('@/lib/ai/coach')>()),
  answerQuestion: mocks.answerQuestion,
}));
vi.mock('@/lib/rag/corpus', () => ({ loadCorpus: mocks.loadCorpus }));
vi.mock('@/lib/rag/embed', () => ({ embedQuery: mocks.embedQuery, EMBED_MODEL: 'm', EMBED_DIM: 1 }));
vi.mock('@/lib/ai/client', () => ({ createGeminiClient: () => ({ complete: vi.fn() }) }));

import { POST } from './route';

function post(body: unknown) {
  return POST(
    new Request('http://localhost/api/coach', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

describe('POST /api/coach', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadCorpus.mockReturnValue({ chunks: [], vectors: [], sources: {} });
    mocks.embedQuery.mockResolvedValue(null);
  });

  it('returns 200 with the grounded answer and sources for a valid question', async () => {
    mocks.answerQuestion.mockResolvedValue({
      grounded: true,
      answer: 'Flying east advances your clock.',
      sources: ['eastward-vs-westward.md'],
    });

    const res = await post({ question: 'Why is flying east worse?' });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      grounded: true,
      answer: 'Flying east advances your clock.',
      sources: ['eastward-vs-westward.md'],
    });
  });

  it('rejects a missing or empty question with 400 and never calls the orchestrator', async () => {
    const res = await post({ question: '   ' });

    expect(res.status).toBe(400);
    expect(mocks.answerQuestion).not.toHaveBeenCalled();
  });

  it('passes a refusal through as 200 with grounded false', async () => {
    mocks.answerQuestion.mockResolvedValue({
      grounded: false,
      answer: 'I have nothing on that.',
      sources: [],
    });

    const res = await post({ question: 'best sushi in Tokyo?' });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ grounded: false, sources: [] });
  });
});
