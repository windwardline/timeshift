'use client';

import Link from 'next/link';
import { useState } from 'react';

// US-R: the standalone Jetlag Coach. Asks POST /api/coach a question and renders
// the grounded answer with its Sources, or an honest refusal (no Sources) when
// the question falls outside TimeShift's knowledge base.
interface SourceRef {
  title: string;
  url: string;
}

interface CoachResponse {
  grounded: boolean;
  answer: string;
  followUp: string;
  sources: SourceRef[];
}

const EXAMPLES = [
  'Why is flying east worse for jetlag?',
  'When should I take melatonin?',
  'Should I nap when I land?',
];

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
        <p className="eyebrow">Sourced jetlag Q&amp;A · not tied to a trip</p>
        <h1 className="wordmark">Jetlag Coach</h1>
        <p className="lede">
          Ask <em>any</em> jetlag or sleep question. The coach answers <strong>only</strong> from a
          curated research knowledge base, <strong>cites the authoritative sources</strong> it drew
          on (CDC, NHS, Sleep Foundation&hellip;), and tells you honestly when a question falls
          outside what it knows. General knowledge — for a plan tailored to a specific flight, build
          a trip.
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

      <p
        data-testid="coach-build-trip"
        className="advice-sub"
        style={{ marginTop: 12, marginBottom: 0, fontSize: 13, color: 'var(--muted)' }}
      >
        Planning a specific flight?{' '}
        <Link href="/" style={{ color: 'var(--accent, #8fb3ff)' }}>
          Build a trip for a computed, hour-by-hour plan →
        </Link>
      </p>

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
              {result.sources.length > 0 && (
                <p
                  data-testid="coach-grounded-badge"
                  className="mono"
                  style={{
                    margin: '0 0 12px',
                    fontSize: 12.5,
                    color: 'rgb(140,210,180)',
                  }}
                >
                  ✓ Grounded in {result.sources.length} cited{' '}
                  {result.sources.length === 1 ? 'source' : 'sources'}
                </p>
              )}
              <p className="eyebrow" style={{ marginBottom: 8 }}>
                Answer
              </p>
              <p
                data-testid="coach-answer"
                style={{ margin: '0 0 18px', color: '#e7eaff', lineHeight: 1.6 }}
              >
                {result.answer}
              </p>

              {result.followUp && (
                <div
                  data-testid="coach-followup"
                  style={{
                    margin: '0 0 18px',
                    padding: '12px 14px',
                    borderRadius: 10,
                    background: 'rgba(120,160,255,0.08)',
                    borderLeft: '3px solid rgba(120,160,255,0.6)',
                  }}
                >
                  <p className="eyebrow" style={{ marginBottom: 6 }}>
                    Next step
                  </p>
                  <p style={{ margin: 0, color: '#e7eaff', lineHeight: 1.6 }}>{result.followUp}</p>
                </div>
              )}

              {result.sources.length > 0 && (
                <>
                  <p className="eyebrow" style={{ marginBottom: 8 }}>
                    Sources
                  </p>
                  <ul data-testid="coach-sources" style={{ margin: 0, paddingLeft: 18 }}>
                    {result.sources.map((s) => (
                      <li key={s.url} style={{ fontSize: 13, marginBottom: 4 }}>
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: 'var(--accent, #8fb3ff)' }}
                        >
                          {s.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                </>
              )}
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
