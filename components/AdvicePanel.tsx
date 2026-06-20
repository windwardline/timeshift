'use client';

import { useState } from 'react';

interface AdvicePlan {
  summary: string;
  preFlight: string[];
  inFlight: string[];
  postArrival: string[];
}

const SECTIONS: { key: keyof Omit<AdvicePlan, 'summary'>; label: string }[] = [
  { key: 'preFlight', label: 'Before the flight' },
  { key: 'inFlight', label: 'In the air' },
  { key: 'postArrival', label: 'After you land' },
];

/**
 * The live AI beat (CLAUDE.md §13 / docs/AI_ADVICE.md). Posts to the server
 * route, which makes the real model call behind the env key. A visible
 * "generating…" state shows the live call happening; the panel is clearly
 * labelled "AI-generated" to mark the seam between the deterministic timeline
 * and the model's narrative. Output is never hardcoded — it's unique per trip.
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
    <section
      style={{
        marginTop: 24,
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        padding: 20,
        background: '#fafaf9',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Your jetlag plan</h2>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: '#6d28d9',
            background: '#ede9fe',
            border: '1px solid #ddd6fe',
            borderRadius: 999,
            padding: '2px 8px',
          }}
        >
          AI-generated
        </span>
      </div>

      <button
        onClick={getAdvice}
        disabled={loading}
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: '#fff',
          background: loading ? '#94a3b8' : '#4f46e5',
          border: 'none',
          borderRadius: 8,
          padding: '8px 16px',
          cursor: loading ? 'default' : 'pointer',
        }}
      >
        {loading ? 'Generating…' : 'Get my jetlag plan'}
      </button>

      {error && (
        <p style={{ color: '#b91c1c', fontSize: 13, marginTop: 12 }}>{error}</p>
      )}

      {plan && (
        <div style={{ marginTop: 16 }}>
          <p style={{ fontWeight: 600, marginTop: 0 }}>{plan.summary}</p>
          {SECTIONS.map(({ key, label }) => (
            <div key={key} style={{ marginTop: 12 }}>
              <h3 style={{ fontSize: 14, margin: '0 0 4px' }}>{label}</h3>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: '#334155' }}>
                {plan[key].map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
