'use client';

import { useState } from 'react';

interface AdvicePlan {
  summary: string;
  preFlight: string[];
  inFlight: string[];
  postArrival: string[];
}

const PHASES: { key: keyof Omit<AdvicePlan, 'summary'>; label: string; icon: string }[] = [
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
        A plan written for this exact itinerary — when to shift your clock, sleep, and chase
        light.
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
        </div>
      )}
    </section>
  );
}
