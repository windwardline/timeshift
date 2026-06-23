'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AIRPORTS } from '@/lib/airports';

// The picker offers the unique IANA zones from the curated airport list, so
// every option is a zone the engine already understands and the server
// validator accepts. The server re-validates regardless (US-A3).
const ZONES = Array.from(new Set(AIRPORTS.map((a) => a.tz))).sort();

export function HomeZoneForm({ current }: { current: string }) {
  const router = useRouter();
  const [zone, setZone] = useState(current);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setStatus(null);
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ homeTimeZone: zone }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? 'Could not save your home time zone.');
        return;
      }
      setStatus('Saved — your trips now use this as the baseline.');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ padding: 24, maxWidth: 480 }}>
      <label className="eyebrow" htmlFor="homeZone" style={{ display: 'block', marginBottom: 8 }}>
        Home time zone
      </label>
      <select
        id="homeZone"
        className="mono"
        value={zone}
        onChange={(e) => setZone(e.target.value)}
        style={{ width: '100%', padding: '10px 12px' }}
      >
        {ZONES.map((z) => (
          <option key={z} value={z}>
            {z}
          </option>
        ))}
      </select>
      <p style={{ color: 'var(--muted)', fontSize: 13, margin: '10px 0 16px' }}>
        Your biological-clock baseline — the zone your body is on before a trip. The timeline’s clock
        shift and sleep windows are measured from here.
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button type="button" className="btn" onClick={save} disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </button>
        {status && (
          <span className="mono" style={{ color: '#3ee6d0', fontSize: 13 }}>
            {status}
          </span>
        )}
        {error && (
          <span className="mono" style={{ color: '#ff8a8a', fontSize: 13 }}>
            {error}
          </span>
        )}
      </div>
    </div>
  );
}
