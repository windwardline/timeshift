'use client';

import { useState } from 'react';
import Link from 'next/link';
import { describeComputedFacts } from '@/lib/trips/computed-summary';

interface AdvicePlan {
  summary: string;
  preFlight: string[];
  inFlight: string[];
  postArrival: string[];
  // The engine-computed facts the plan was built from (US-F1). Present on every
  // successful response so the panel can show what it was computed from.
  facts: {
    offsetDeltaMinutes: number;
    crossesDateLine: boolean;
    sleepWindows: { label: string }[];
  };
}

const PHASES: { key: 'preFlight' | 'inFlight' | 'postArrival'; label: string; icon: string }[] = [
  { key: 'preFlight', label: 'Before you fly', icon: '☀' },
  { key: 'inFlight', label: 'In the air', icon: '☾' },
  { key: 'postArrival', label: 'After you land', icon: '✦' },
];

/**
 * The live AI beat (CLAUDE.md §13 / docs/AI_ADVICE.md). Posts to the server
 * route, which makes the real per-trip model call behind the env key. A visible
 * "consulting" state shows the live call in flight; the panel is clearly marked
 * "AI-generated". Output is unique to the on-screen trip — it can't be canned.
 */
export function AdvicePanel({ tripId }: { tripId: string }) {
  const [plan, setPlan] = useState<AdvicePlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function getAdvice() {
    setLoading(true);
    setError(null);
    setPlan(null);
    try {
      const res = await fetch(`/api/trips/${tripId}/advice`, { method: 'POST' });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `Request failed (${res.status})`);
        return;
      }
      setPlan((await res.json()) as AdvicePlan);
    } catch {
      setError('Network error — please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="card advice">
      <div className="advice-head">
        <h2>Your jetlag plan</h2>
        <span className="badge-ai">AI-generated</span>
      </div>
      <p className="advice-sub">
        <strong>Computed for this exact itinerary.</strong> The temporal engine works out your
        clock shift and in-air sleep windows, then the model turns those numbers into a
        when-to-do-what plan — pre-flight, in the air, and after you land.
      </p>

      <button className="btn" onClick={getAdvice} disabled={loading}>
        {loading ? 'Consulting…' : plan ? 'Regenerate plan' : 'Get my jetlag plan'}
      </button>

      {loading && (
        <div className="thinking">
          <span className="orbits">
            <i />
            <i />
            <i />
          </span>
          Reading your timeline and writing a plan…
        </div>
      )}

      {error && <p className="err">{error}</p>}

      {plan && (
        <div>
          <div
            className="computed-from reveal"
            style={{
              margin: '4px 0 16px',
              padding: '12px 14px',
              borderRadius: 10,
              background: 'rgba(120,200,170,0.08)',
              borderLeft: '3px solid rgba(120,200,170,0.6)',
            }}
          >
            <span className="eyebrow" style={{ display: 'block', marginBottom: 8 }}>
              Computed from your flight
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {describeComputedFacts(plan.facts).map((chip) => (
                <span
                  key={chip}
                  className="mono"
                  style={{
                    fontSize: 12.5,
                    padding: '4px 10px',
                    borderRadius: 999,
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.12)',
                  }}
                >
                  {chip}
                </span>
              ))}
            </div>
          </div>

          <p className="advice-summary reveal">{plan.summary}</p>
          <div className="phases">
            {PHASES.map(({ key, label, icon }, idx) => (
              <div key={key} className={`phase reveal${idx ? `-${idx + 1}` : ''}`}>
                <h3>
                  <span aria-hidden>{icon}</span>
                  {label}
                </h3>
                <ul>
                  {plan[key].map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <p className="advice-sub" style={{ marginTop: 16, marginBottom: 0 }}>
            Have a general jetlag question instead?{' '}
            <Link href="/coach" style={{ color: 'var(--accent, #8fb3ff)' }}>
              Ask the Jetlag Coach →
            </Link>
          </p>
        </div>
      )}
    </section>
  );
}
