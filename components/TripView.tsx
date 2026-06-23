import { assembleTimeline } from '@/lib/engine/timeline';
import { dayNightArcs } from '@/lib/engine/arcs';
import { recommendSleepWindows } from '@/lib/engine/sleep';
import { offsetMinutes } from '@/lib/engine/time';
import { Timeline } from '@/components/Timeline';
import { AdvicePanel } from '@/components/AdvicePanel';

interface ViewSegment {
  flightNumber: string | null;
  departureAirport: string;
  arrivalAirport: string;
  departureTime: Date;
  arrivalTime: Date;
  departureTz: string;
  arrivalTz: string;
  arrivalLat: number | null;
  arrivalLng: number | null;
}

interface ViewTrip {
  id: string;
  name: string;
  destination: string;
  segments: ViewSegment[];
}

// Runs the real DB → engine pipeline for one trip and renders it: the header,
// the luminous timeline, and the live AI panel. Server component — the engine
// runs on the server; only the AI panel is interactive. "Home" is the journey's
// origin zone (the first departure), which is the traveler's baseline clock.
export function TripView({ trip }: { trip: ViewTrip }) {
  const homeTimeZone = trip.segments[0].departureTz;
  const timeline = assembleTimeline(trip);
  const layovers = timeline.items.filter((i) => i.kind === 'layover');
  const last = trip.segments[trip.segments.length - 1];
  const arcs =
    last.arrivalLat != null && last.arrivalLng != null
      ? dayNightArcs(timeline.start, timeline.end, trip.destination, last.arrivalLat, last.arrivalLng)
      : [];
  const sleep = recommendSleepWindows(timeline, homeTimeZone, trip.destination);

  const deltaMinutes =
    offsetMinutes(last.arrivalTime, trip.destination) -
    offsetMinutes(trip.segments[0].departureTime, trip.segments[0].departureTz);
  const shift = `${deltaMinutes >= 0 ? '+' : ''}${(deltaMinutes / 60).toFixed(1)}h`;

  return (
    <>
      <section className="reveal">
        <p className="eyebrow">Destination clock · {trip.destination}</p>
        <div className="trip-head">
          <h2>{trip.name}</h2>
          <div className="route-pills">
            <span className="pill mono">home {homeTimeZone}</span>
            <span className="pill mono">dest {trip.destination}</span>
            <span className="pill mono">
              shift <span className="shift">{shift}</span>
            </span>
          </div>
        </div>
      </section>

      <div className="stage reveal-2">
        <Timeline
          axisStart={timeline.start}
          axisEnd={timeline.end}
          flights={trip.segments}
          layovers={layovers}
          arcs={arcs}
          sleep={sleep}
          destTz={trip.destination}
        />
      </div>

      <div className="legend reveal-2">
        <span>
          <i className="swatch" style={{ background: 'linear-gradient(180deg, rgba(255,209,102,0.78), rgba(255,178,62,0.48))' }} /> daylight
        </span>
        <span>
          <i className="swatch" style={{ background: 'linear-gradient(180deg, #1d2550, #0b1024)' }} /> night
        </span>
        <span>
          <i className="swatch" style={{ background: 'linear-gradient(90deg, #7c5cff, #9d7cff)' }} /> flight
        </span>
        <span>
          <i className="swatch" style={{ background: 'linear-gradient(180deg, rgba(62,230,208,0.9), rgba(43,182,214,0.62))' }} /> sleep window
        </span>
        <span style={{ color: 'var(--muted)' }}>☀ / ☾ mark sunrise &amp; sunset</span>
      </div>

      <AdvicePanel tripId={trip.id} />
    </>
  );
}
