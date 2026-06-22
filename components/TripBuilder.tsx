'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AIRPORTS, findAirport } from '@/lib/airports';

interface LegDraft {
  dep: string;
  arr: string;
  depLocal: string;
  arrLocal: string;
}

const blankLeg: LegDraft = { dep: '', arr: '', depLocal: '', arrLocal: '' };
const exampleLegs: LegDraft[] = [
  { dep: 'JFK', arr: 'HND', depLocal: '2025-07-01T11:00', arrLocal: '2025-07-02T15:00' },
];

export function TripBuilder() {
  const router = useRouter();
  const [name, setName] = useState('My trip to Tokyo');
  const [legs, setLegs] = useState<LegDraft[]>(exampleLegs);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(i: number, patch: Partial<LegDraft>) {
    setLegs((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  async function submit() {
    setError(null);
    if (!name.trim()) return setError('Give your trip a name.');
    for (const [i, l] of legs.entries()) {
      if (!l.dep || !l.arr || !l.depLocal || !l.arrLocal) {
        return setError(`Fill in every field for leg ${i + 1}.`);
      }
    }

    const segments = legs.map((l) => {
      const dep = findAirport(l.dep)!;
      const arr = findAirport(l.arr)!;
      return {
        departureAirport: l.dep,
        arrivalAirport: l.arr,
        departureLocal: l.depLocal,
        arrivalLocal: l.arrLocal,
        departureTz: dep.tz,
        arrivalTz: arr.tz,
        departureLat: dep.lat,
        departureLng: dep.lng,
        arrivalLat: arr.lat,
        arrivalLng: arr.lng,
      };
    });

    setBusy(true);
    try {
      const res = await fetch('/api/trips', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), segments }),
      });
      const body = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
      if (!res.ok || !body.id) {
        setError(body.error ?? `Could not create the trip (${res.status}).`);
        return;
      }
      router.push(`/trips/${body.id}`);
    } catch {
      setError('Network error — please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card reveal-2" style={{ marginTop: 28, padding: 24 }}>
      <p className="eyebrow" style={{ marginBottom: 10 }}>
        Build your own journey
      </p>

      <div className="field" style={{ marginBottom: 18 }}>
        <label htmlFor="trip-name">Trip name</label>
        <input
          id="trip-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Honeymoon to Tokyo"
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {legs.map((leg, i) => (
          <div className="leg" key={i}>
            <div className="leg-head">
              <span className="n">Leg {i + 1}</span>
              {legs.length > 1 && (
                <button
                  type="button"
                  className="linkish"
                  onClick={() => setLegs((prev) => prev.filter((_, idx) => idx !== i))}
                >
                  Remove
                </button>
              )}
            </div>
            <div className="grid-2">
              <div className="field">
                <label>From</label>
                <select value={leg.dep} onChange={(e) => update(i, { dep: e.target.value })}>
                  <option value="">Select airport…</option>
                  {AIRPORTS.map((a) => (
                    <option key={a.iata} value={a.iata}>
                      {a.city} ({a.iata})
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>To</label>
                <select value={leg.arr} onChange={(e) => update(i, { arr: e.target.value })}>
                  <option value="">Select airport…</option>
                  {AIRPORTS.map((a) => (
                    <option key={a.iata} value={a.iata}>
                      {a.city} ({a.iata})
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Departs (local)</label>
                <input
                  type="datetime-local"
                  value={leg.depLocal}
                  onChange={(e) => update(i, { depLocal: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Arrives (local)</label>
                <input
                  type="datetime-local"
                  value={leg.arrLocal}
                  onChange={(e) => update(i, { arrLocal: e.target.value })}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => setLegs((prev) => [...prev, { ...blankLeg }])}
        >
          + Add a layover leg
        </button>
        <button type="button" className="btn" onClick={submit} disabled={busy}>
          {busy ? 'Building your timeline…' : 'Visualize my trip →'}
        </button>
      </div>

      {error && <p className="err">{error}</p>}
    </section>
  );
}
