'use client';

import Link from 'next/link';
import { useState } from 'react';

// US-R: the standalone Jetlag Coach. Asks POST /api/coach a question and renders
// the grounded answer with its Sources, or an honest refusal (no Sources) when
// the question falls outside TimeShift's knowledge base.
interface CoachResponse {
  grounded: boolean;
  answer: string;
  sources: string[];
}

const EXAMPLES = [
  'Why is flying east worse for jetlag?',
  'When should I take melatonin?',
  'Should I nap when I land?',
];

function prettySource(docId: string): string {
  return docId.replace(/\.md$/, '').replace(/-/g, ' ');
}

export default function CoachPage() {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CoachResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function ask(q: string) {
    const trimmed = q.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question: trimmed }),
      });
      if (!res.ok) throw new Error('The coach could not answer right now.');
      setResult((await res.json()) as CoachResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <div style={{ marginBottom: 8 }}>
        <Link className="btn btn-ghost" href="/" style={{ padding: '7px 14px', fontSize: 13 }}>
          ← TimeShift
        </Link>
      </div>

      <header className="reveal">
        <p className="eyebrow">Grounded jetlag Q&amp;A</p>
        <h1 className="wordmark">Jetlag Coach</h1>
        <p className="lede">
          Ask a jetlag or sleep question. The coach answers only from TimeShift&rsquo;s curated
          knowledge base and shows you the sources it used — and it will tell you honestly when a
          question falls outside what it knows.
        </p>
      </header>

      <section className="card reveal-2" style={{ marginTop: 28, padding: 24 }}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void ask(question);
          }}
        >
          <textarea
            aria-label="Your jetlag question"
            placeholder="e.g. Why is flying east worse for jetlag?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={3}
            style={{
              width: '100%',
              padding: '12px 14px',
              fontFamily: 'inherit',
              fontSize: 15,
              borderRadius: 10,
              resize: 'vertical',
            }}
          />
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginTop: 12 }}>
            <button className="btn" type="submit" disabled={loading || !question.trim()}>
              {loading ? 'Thinking…' : 'Ask the coach'}
            </button>
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                className="btn btn-ghost"
                style={{ padding: '7px 12px', fontSize: 12.5 }}
                onClick={() => {
                  setQuestion(ex);
                  void ask(ex);
                }}
              >
                {ex}
              </button>
            ))}
          </div>
        </form>
      </section>

      {error && (
        <section className="card" style={{ marginTop: 20, padding: 20 }}>
          <p style={{ margin: 0, color: 'var(--muted)' }}>{error}</p>
        </section>
      )}

      {result && (
        <section
          className="card"
          data-testid="coach-result"
          data-grounded={result.grounded}
          style={{
            marginTop: 20,
            padding: 24,
            borderColor: result.grounded ? undefined : 'rgba(255,180,90,0.5)',
          }}
        >
          {result.grounded ? (
            <>
              <p className="eyebrow" style={{ marginBottom: 8 }}>
                Answer
              </p>
              <p style={{ margin: '0 0 18px', color: '#e7eaff', lineHeight: 1.6 }}>{result.answer}</p>
              <p className="eyebrow" style={{ marginBottom: 8 }}>
                Sources
              </p>
              <ul data-testid="coach-sources" style={{ margin: 0, paddingLeft: 18 }}>
                {result.sources.map((s) => (
                  <li key={s} className="mono" style={{ fontSize: 13, color: 'var(--muted)' }}>
                    {prettySource(s)}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <p className="eyebrow" style={{ marginBottom: 8, color: 'rgb(255,190,120)' }}>
                Outside the knowledge base
              </p>
              <p data-testid="coach-refusal" style={{ margin: 0, color: '#e7eaff', lineHeight: 1.6 }}>
                {result.answer}
              </p>
            </>
          )}
        </section>
      )}
    </main>
  );
}
