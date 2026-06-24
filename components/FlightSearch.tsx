'use client';

import { useState } from 'react';
import { AIRPORTS } from '@/lib/airports';
import type { FlightOption, SortKey } from '@/lib/flights/types';

// Real-flight search for one leg (spec §1). Pick From/To/date, get a sortable
// list of real flights, click one to fill the leg. Errors (incl. 503 when the
// service isn't configured) surface inline — the manual inputs stay available as
// the fallback, so the user is never blocked.

function hhmm(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
function dayOffset(depLocal: string, arrLocal: string): string {
  const dep = depLocal.slice(0, 10);
  const arr = arrLocal.slice(0, 10);
  return arr > dep ? ' (+1)' : '';
}

export function FlightSearch({ defaultFrom, defaultTo, onSelect }: { defaultFrom?: string; defaultTo?: string; onSelect: (f: FlightOption) => void }) {
  const [from, setFrom] = useState(defaultFrom ?? '');
  const [to, setTo] = useState(defaultTo ?? '');
  const [date, setDate] = useState('');
  const [sort, setSort] = useState<SortKey>('departure');
  const [results, setResults] = useState<FlightOption[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search(nextSort: SortKey = sort) {
    if (!from || !to || !date) return setError('Choose both airports and a date.');
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/flights/search?from=${from}&to=${to}&date=${date}&sort=${nextSort}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? 'Flight search failed — you can still enter the flight manually below.');
        setResults(null);
        return;
      }
      setResults(body.flights as FlightOption[]);
    } catch {
      setError('Network error — enter the flight manually below.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ padding: 14, marginBottom: 10, background: 'rgba(124,92,255,0.06)' }}>
      <p className="eyebrow" style={{ marginBottom: 8 }}>Search real flights</p>
      <div className="grid-2">
        <div className="field">
          <label>From</label>
          <select value={from} onChange={(e) => setFrom(e.target.value)}>
            <option value="">Select…</option>
            {AIRPORTS.map((a) => <option key={a.iata} value={a.iata}>{a.city} ({a.iata})</option>)}
          </select>
        </div>
        <div className="field">
          <label>To</label>
          <select value={to} onChange={(e) => setTo(e.target.value)}>
            <option value="">Select…</option>
            {AIRPORTS.map((a) => <option key={a.iata} value={a.iata}>{a.city} ({a.iata})</option>)}
          </select>
        </div>
        <div className="field">
          <label>Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="field" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={() => search()} disabled={busy}>
            {busy ? 'Searching…' : 'Search flights'}
          </button>
        </div>
      </div>

      {error && <p className="err" style={{ marginTop: 8 }}>{error}</p>}

      {results && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span className="mono" style={{ fontSize: 12, color: 'var(--muted)' }}>
              {results.length} flight{results.length === 1 ? '' : 's'}
            </span>
            <label className="mono" style={{ fontSize: 12 }}>
              sort{' '}
              <select
                value={sort}
                onChange={(e) => { const s = e.target.value as SortKey; setSort(s); void search(s); }}
              >
                <option value="departure">departure</option>
                <option value="arrival">arrival</option>
                <option value="duration">duration</option>
              </select>
            </label>
          </div>
          {results.length === 0 ? (
            <p className="mono" style={{ fontSize: 12.5, color: 'var(--muted)' }}>
              No flights found — try another date or enter the flight manually below.
            </p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {results.map((f, i) => (
                <li key={`${f.flightNumber}-${i}`}>
                  <button
                    type="button"
                    className="flight-row mono"
                    onClick={() => onSelect(f)}
                    style={{ width: '100%', textAlign: 'left', padding: '8px 10px', cursor: 'pointer', border: '1px solid rgba(157,124,255,0.25)', borderRadius: 8, background: 'transparent', color: 'inherit', fontSize: 12.5 }}
                  >
                    <strong>{f.flightNumber}</strong> · {f.departureIata} {f.departureLocal.slice(11)} → {f.arrivalIata} {f.arrivalLocal.slice(11)}{dayOffset(f.departureLocal, f.arrivalLocal)} · {hhmm(f.durationMinutes)}
                    {f.departureTerminal || f.arrivalTerminal ? ` · T${f.departureTerminal ?? '?'}→T${f.arrivalTerminal ?? '?'}` : ''}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
