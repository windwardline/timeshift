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
const H = 300;
const PAD = 28;
const INNER = W - PAD * 2;
const BAND_TOP = 80;
const BAND_H = 132;
const BAR_TOP = 104;
const BAR_H = 84;
const MONO = "'JetBrains Mono', ui-monospace, monospace";

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
 * The signature element (US-D1/D2/D3): one luminous UTC axis carrying the
 * destination's day/night arcs, the flight legs, layovers, and the recommended
 * sleep windows. Every element is positioned by the tested scale helper
 * (lib/engine/scale.ts), so the geometry is correct by construction; the visual
 * treatment (gradients, glow, mono readouts) is purely presentational.
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
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Journey timeline with destination day and night and recommended sleep windows">
      <defs>
        <linearGradient id="g-day" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffd166" stopOpacity="0.34" />
          <stop offset="100%" stopColor="#ffb23e" stopOpacity="0.12" />
        </linearGradient>
        <linearGradient id="g-night" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1d2550" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#0a0f24" stopOpacity="0.95" />
        </linearGradient>
        <linearGradient id="g-flight" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#7c5cff" />
          <stop offset="100%" stopColor="#9d7cff" />
        </linearGradient>
        <linearGradient id="g-sleep" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3ee6d0" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#2bb6d6" stopOpacity="0.55" />
        </linearGradient>
        <filter id="glow" x="-30%" y="-60%" width="160%" height="220%">
          <feGaussianBlur stdDeviation="6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <pattern id="hatch" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="9" height="9" fill="rgba(152,163,214,0.10)" />
          <line x1="0" y1="0" x2="0" y2="9" stroke="rgba(157,124,255,0.45)" strokeWidth="2.5" />
        </pattern>
      </defs>

      {/* Destination day / night arcs as the luminous backdrop */}
      <g className="reveal">
        {arcs.map((arc, i) => {
          const { x, width } = place(arc.start, arc.end);
          return (
            <rect
              key={`arc-${i}`}
              x={x}
              y={BAND_TOP}
              width={width}
              height={BAND_H}
              fill={arc.kind === 'day' ? 'url(#g-day)' : 'url(#g-night)'}
              rx={2}
            />
          );
        })}
        {/* a few faint stars in the night */}
        {arcs
          .filter((a) => a.kind === 'night')
          .flatMap((arc, ai) => {
            const { x, width } = place(arc.start, arc.end);
            return [0.25, 0.55, 0.8].map((f, si) => (
              <circle
                key={`star-${ai}-${si}`}
                cx={x + width * f}
                cy={BAND_TOP + 18 + (si % 2) * 84}
                r={1.1}
                fill="#cdd3ff"
                opacity={0.5}
              />
            ));
          })}
      </g>

      {/* Layovers — ground time between legs */}
      <g className="reveal-2">
        {layovers.map((lay, i) => {
          const { x, width } = place(lay.start, lay.end);
          return (
            <g key={`lay-${i}`}>
              <rect x={x} y={BAR_TOP + 18} width={width} height={BAR_H - 36} fill="url(#hatch)" rx={6} />
              <text x={x + width / 2} y={BAR_TOP + BAR_H / 2 + 4} fill="#c3c9ee" fontSize="11.5" textAnchor="middle" style={{ fontFamily: MONO }}>
                {hours(lay.start, lay.end)} layover
              </text>
            </g>
          );
        })}
      </g>

      {/* Sleep windows — glowing, behind the bar labels */}
      <g className="reveal-2" filter="url(#glow)">
        {sleep.map((w, i) => {
          const { x, width } = place(w.start, w.end);
          return <rect key={`sleep-${i}`} x={x} y={BAR_TOP} width={width} height={BAR_H} fill="url(#g-sleep)" rx={10} />;
        })}
      </g>

      {/* Flight legs */}
      <g className="reveal-3">
        {flights.map((f, i) => {
          const { x, width } = place(f.departureTime, f.arrivalTime);
          return (
            <g key={`flight-${i}`}>
              <rect x={x} y={BAR_TOP} width={width} height={BAR_H} fill="url(#g-flight)" rx={10} filter="url(#glow)" opacity={0.96} />
              <text x={x + 14} y={BAR_TOP + 26} fill="#fff" fontSize="14" fontWeight={700}>
                {f.departureAirport} → {f.arrivalAirport}
              </text>
              <text x={x + 14} y={BAR_TOP + 46} fill="rgba(255,255,255,0.82)" fontSize="11.5" style={{ fontFamily: MONO }}>
                {clock(f.departureTime, destTz)}–{clock(f.arrivalTime, destTz)} · {hours(f.departureTime, f.arrivalTime)}
              </text>
            </g>
          );
        })}
        {sleep.map((w, i) => {
          const { x, width } = place(w.start, w.end);
          return (
            <text key={`sl-${i}`} x={x + width / 2} y={BAR_TOP + BAR_H - 12} fill="#04263a" fontSize="11" fontWeight={700} textAnchor="middle" style={{ fontFamily: MONO }}>
              ☾ sleep
            </text>
          );
        })}
      </g>

      {/* Axis */}
      <line x1={PAD} y1={BAND_TOP + BAND_H + 22} x2={W - PAD} y2={BAND_TOP + BAND_H + 22} stroke="rgba(157,124,255,0.3)" />
      <text x={PAD} y={BAND_TOP + BAND_H + 44} fill="#98a3d6" fontSize="11.5" style={{ fontFamily: MONO }}>
        {clock(axisStart, destTz)} · {destTz}
      </text>
      <text x={W - PAD} y={BAND_TOP + BAND_H + 44} fill="#98a3d6" fontSize="11.5" textAnchor="end" style={{ fontFamily: MONO }}>
        {clock(axisEnd, destTz)} · {destTz}
      </text>
    </svg>
  );
}
