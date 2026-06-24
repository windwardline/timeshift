'use client';

import { useEffect, useState } from 'react';
import { DateTime } from 'luxon';
import type { FlightStatus } from '@/lib/flights/types';

// Near-term live status for a leg (spec §3, decision #3). Renders nothing unless
// the flight has a number and departs within the window (~48h ahead / 24h past) —
// a trip planned weeks out has no live data, so we don't pretend it does. Any
// fetch error or an `unknown` status renders nothing, never a broken badge.
const AHEAD_MS = 48 * 60 * 60 * 1000;
const BEHIND_MS = 24 * 60 * 60 * 1000;

const LABELS: Record<FlightStatus['state'], { text: string; color: string } | null> = {
  scheduled: { text: 'On schedule', color: '#3ee6d0' },
  active: { text: 'In the air', color: '#9d7cff' },
  landed: { text: 'Landed', color: '#98a3d6' },
  delayed: { text: 'Delayed', color: '#ffb23e' },
  cancelled: { text: 'Cancelled', color: '#ff8a8a' },
  unknown: null,
};

function isNearTerm(departureIso: string, now: number): boolean {
  const dep = new Date(departureIso).getTime();
  return dep <= now + AHEAD_MS && dep >= now - BEHIND_MS;
}

export function LiveStatusBadge({
  flightNumber,
  departureTime,
  departureTz,
}: {
  flightNumber: string | null;
  departureTime: string; // ISO UTC
  departureTz: string;
}) {
  const [status, setStatus] = useState<FlightStatus | null>(null);

  useEffect(() => {
    if (!flightNumber || !isNearTerm(departureTime, Date.now())) return;
    const date = DateTime.fromISO(departureTime, { zone: 'utc' }).setZone(departureTz).toFormat('yyyy-MM-dd');
    let active = true;
    fetch(`/api/flights/status?flight=${encodeURIComponent(flightNumber)}&date=${date}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => { if (active && body?.status) setStatus(body.status as FlightStatus); })
      .catch(() => {}); // a status failure simply shows no badge
    return () => { active = false; };
  }, [flightNumber, departureTime, departureTz]);

  if (!status) return null;
  const label = LABELS[status.state];
  if (!label) return null;

  const text = status.state === 'delayed' && status.delayMinutes ? `${label.text} ${status.delayMinutes}m` : label.text;
  return (
    <span
      className="mono"
      style={{ fontSize: 11.5, fontWeight: 600, color: label.color, border: `1px solid ${label.color}55`, borderRadius: 999, padding: '2px 9px' }}
    >
      {flightNumber} · {text}
    </span>
  );
}
