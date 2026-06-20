import { DateTime } from 'luxon';
import { intervalToRect, type Axis } from '@/lib/engine/scale';
import type { Arc } from '@/lib/engine/arcs';
import type { SleepWindow } from '@/lib/engine/sleep';

export interface TimelineFlight {
  departureAirport: string;
  arrivalAirport: string;
  departureTime: Date;
  arrivalTime: Date;
}

export interface TimelineLayover {
  start: Date;
  end: Date;
}

export interface TimelineProps {
  axisStart: Date;
  axisEnd: Date;
  flights: TimelineFlight[];
  layovers: TimelineLayover[];
  arcs: Arc[];
  sleep: SleepWindow[];
  destTz: string;
}

const W = 960;
const H = 260;
const PAD = 24;
const INNER = W - PAD * 2;
const BAND_TOP = 96;
const BAND_H = 72;

function clock(instant: Date, tz: string): string {
  return DateTime.fromJSDate(instant, { zone: tz }).toFormat('HH:mm');
}

function hours(start: Date, end: Date): string {
  const m = Math.round((end.getTime() - start.getTime()) / 60000);
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h}h ${rem}m` : `${h}h`;
}

/**
 * Horizontal timeline (US-D1/D2/D3): destination day/night arcs as the
 * background, flight legs as solid bars, layovers as hatched blocks, and
 * recommended sleep windows highlighted over the in-air bars. Every element is
 * positioned by the tested scale helper (lib/engine/scale.ts) against one shared
 * UTC axis, so geometry stays correct by construction.
 */
export function Timeline({
  axisStart,
  axisEnd,
  flights,
  layovers,
  arcs,
  sleep,
  destTz,
}: TimelineProps) {
  const axis: Axis = { start: axisStart, end: axisEnd };
  const place = (start: Date, end: Date) => {
    const r = intervalToRect(start, end, axis, INNER);
    return { x: PAD + r.x, width: r.width };
  };

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      role="img"
      aria-label="Flight timeline with destination day and night arcs and recommended sleep windows"
      style={{ background: '#0f172a', borderRadius: 12, fontFamily: 'system-ui, sans-serif' }}
    >
      <defs>
        <pattern id="layover-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="8" height="8" fill="#475569" />
          <line x1="0" y1="0" x2="0" y2="8" stroke="#64748b" strokeWidth="3" />
        </pattern>
      </defs>

      {/* Destination day/night arcs as the background band. */}
      {arcs.map((arc, i) => {
        const { x, width } = place(arc.start, arc.end);
        return (
          <rect
            key={`arc-${i}`}
            x={x}
            y={BAND_TOP - 28}
            width={width}
            height={BAND_H + 56}
            fill={arc.kind === 'day' ? '#fcd34d' : '#1e293b'}
            opacity={arc.kind === 'day' ? 0.28 : 0.85}
          />
        );
      })}

      {/* Layover blocks (ground time between legs). */}
      {layovers.map((lay, i) => {
        const { x, width } = place(lay.start, lay.end);
        return (
          <g key={`lay-${i}`}>
            <rect x={x} y={BAND_TOP + 14} width={width} height={BAND_H - 28} fill="url(#layover-hatch)" rx={4} />
            <text x={x + width / 2} y={BAND_TOP + BAND_H / 2 + 4} fill="#e2e8f0" fontSize="11" textAnchor="middle">
              {hours(lay.start, lay.end)} layover
            </text>
          </g>
        );
      })}

      {/* Flight legs. */}
      {flights.map((f, i) => {
        const { x, width } = place(f.departureTime, f.arrivalTime);
        return (
          <g key={`flight-${i}`}>
            <rect x={x} y={BAND_TOP} width={width} height={BAND_H} fill="#2563eb" rx={6} />
            <text x={x + 8} y={BAND_TOP + 22} fill="#fff" fontSize="13" fontWeight={600}>
              {f.departureAirport} → {f.arrivalAirport}
            </text>
            <text x={x + 8} y={BAND_TOP + 40} fill="#bfdbfe" fontSize="11">
              {hours(f.departureTime, f.arrivalTime)}
            </text>
          </g>
        );
      })}

      {/* Recommended sleep windows, over the in-air bars. */}
      {sleep.map((w, i) => {
        const { x, width } = place(w.start, w.end);
        return (
          <g key={`sleep-${i}`}>
            <rect x={x} y={BAND_TOP} width={width} height={BAND_H} fill="#a5b4fc" opacity={0.55} rx={6} />
            <text x={x + width / 2} y={BAND_TOP + BAND_H - 8} fill="#1e1b4b" fontSize="11" textAnchor="middle">
              {'☾'} sleep
            </text>
          </g>
        );
      })}

      {/* Axis: endpoints labelled in destination-local time. */}
      <line x1={PAD} y1={BAND_TOP + BAND_H + 28} x2={W - PAD} y2={BAND_TOP + BAND_H + 28} stroke="#475569" />
      <text x={PAD} y={BAND_TOP + BAND_H + 46} fill="#94a3b8" fontSize="11">
        {clock(axisStart, destTz)} {destTz}
      </text>
      <text x={W - PAD} y={BAND_TOP + BAND_H + 46} fill="#94a3b8" fontSize="11" textAnchor="end">
        {clock(axisEnd, destTz)} {destTz}
      </text>
    </svg>
  );
}
