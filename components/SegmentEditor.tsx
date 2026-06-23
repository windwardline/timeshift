'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DateTime } from 'luxon';

// US-C3: minimal owner-only edit/delete for a trip's flight legs. Editing changes
// the local times (the common correction); airports/zones are preserved and sent
// back so the server re-validates and re-normalizes to UTC. Delete removes the leg
// (the server resequences the rest). Rendered only on the owned trip page.
export interface EditableSegment {
  id: string;
  flightNumber: string | null;
  departureAirport: string;
  arrivalAirport: string;
  departureTime: string; // ISO UTC (serialized from the server Date)
  arrivalTime: string;
  departureTz: string;
  arrivalTz: string;
}

// UTC instant → 'YYYY-MM-DDTHH:mm' wall time at the given zone, for datetime-local.
function toLocalInput(iso: string, tz: string): string {
  return DateTime.fromISO(iso, { zone: 'utc' }).setZone(tz).toFormat("yyyy-MM-dd'T'HH:mm");
}

export function SegmentEditor({ tripId, segments }: { tripId: string; segments: EditableSegment[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(seg: EditableSegment, departureLocal: string, arrivalLocal: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/trips/${tripId}/segments/${seg.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          departureAirport: seg.departureAirport,
          arrivalAirport: seg.arrivalAirport,
          departureLocal,
          arrivalLocal,
          departureTz: seg.departureTz,
          arrivalTz: seg.arrivalTz,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? 'Could not update the flight.');
        return;
      }
      setEditing(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove(seg: EditableSegment) {
    if (!window.confirm(`Delete ${seg.departureAirport} → ${seg.arrivalAirport}?`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/trips/${tripId}/segments/${seg.id}`, { method: 'DELETE' });
      if (!res.ok) {
        setError('Could not delete the flight.');
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="card" style={{ padding: 18, marginTop: 16 }}>
      <summary className="eyebrow" style={{ cursor: 'pointer' }}>Edit flights</summary>
      <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {segments.map((seg) => (
          <li key={seg.id} className="leg" style={{ padding: 12 }}>
            <div className="mono" style={{ fontSize: 13, marginBottom: 8 }}>
              {seg.flightNumber ? `${seg.flightNumber} · ` : ''}{seg.departureAirport} → {seg.arrivalAirport}
            </div>
            {editing === seg.id ? (
              <SegmentEditRow seg={seg} busy={busy} onCancel={() => setEditing(null)} onSave={save} />
            ) : (
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" className="btn btn-ghost" style={{ padding: '5px 10px', fontSize: 12.5 }} onClick={() => setEditing(seg.id)}>
                  Edit times
                </button>
                <button type="button" className="linkish" style={{ color: '#ff8a8a' }} onClick={() => remove(seg)} disabled={busy}>
                  Delete
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {error && <p className="err">{error}</p>}
    </details>
  );
}

function SegmentEditRow({
  seg,
  busy,
  onCancel,
  onSave,
}: {
  seg: EditableSegment;
  busy: boolean;
  onCancel: () => void;
  onSave: (seg: EditableSegment, dep: string, arr: string) => void;
}) {
  const [dep, setDep] = useState(toLocalInput(seg.departureTime, seg.departureTz));
  const [arr, setArr] = useState(toLocalInput(seg.arrivalTime, seg.arrivalTz));

  return (
    <div className="grid-2">
      <div className="field">
        <label>Departs (local)</label>
        <input type="datetime-local" value={dep} onChange={(e) => setDep(e.target.value)} />
      </div>
      <div className="field">
        <label>Arrives (local)</label>
        <input type="datetime-local" value={arr} onChange={(e) => setArr(e.target.value)} />
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
        <button type="button" className="btn" style={{ padding: '5px 12px', fontSize: 12.5 }} onClick={() => onSave(seg, dep, arr)} disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 12.5 }} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
