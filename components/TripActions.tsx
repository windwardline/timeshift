'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// US-B3: owner-only rename/delete for a trip. Rendered on the owned trip page
// (never on the public showcase). Calls the ownership-scoped routes; a 404 means
// the trip isn't the caller's and the UI surfaces that rather than failing silently.
export function TripActions({ tripId, name }: { tripId: string; name: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const next = value.trim();
    if (!next) return setError('Please give the trip a name.');
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/trips/${tripId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: next }),
      });
      if (!res.ok) {
        setError(res.status === 404 ? 'Trip not found.' : 'Could not rename the trip.');
        return;
      }
      setEditing(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm('Delete this trip? This cannot be undone.')) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/trips/${tripId}`, { method: 'DELETE' });
      if (!res.ok) {
        setError('Could not delete the trip.');
        return;
      }
      router.push('/');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
      {editing ? (
        <>
          <input
            aria-label="Trip name"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            style={{ padding: '6px 10px' }}
          />
          <button type="button" className="btn" style={{ padding: '6px 12px', fontSize: 13 }} onClick={save} disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </button>
          <button type="button" className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 13 }} onClick={() => { setEditing(false); setValue(name); setError(null); }}>
            Cancel
          </button>
        </>
      ) : (
        <>
          <button type="button" className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 13 }} onClick={() => setEditing(true)}>
            Rename
          </button>
          <button type="button" className="linkish" onClick={remove} disabled={busy} style={{ color: '#ff8a8a' }}>
            Delete trip
          </button>
        </>
      )}
      {error && <span className="mono" style={{ color: '#ff8a8a', fontSize: 13 }}>{error}</span>}
    </div>
  );
}
