import { assembleTimeline } from '@/lib/engine/timeline';
import { dayNightArcs } from '@/lib/engine/arcs';
import { recommendSleepWindows } from '@/lib/engine/sleep';
import { offsetMinutes } from '@/lib/engine/time';
import { Timeline } from '@/components/Timeline';
import { AdvicePanel } from '@/components/AdvicePanel';

interface ViewSegment {
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
// runs on the server; only the AI panel is interactive.
export function TripView({ trip, homeTimeZone }: { trip: ViewTrip; homeTimeZone: string }) {
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
          <i className="swatch" style={{ background: 'linear-gradient(180deg,#ffd166,#ffb23e)' }} /> daylight
        </span>
        <span>
          <i className="swatch" style={{ background: '#1d2550' }} /> night
        </span>
        <span>
          <i className="swatch" style={{ background: 'linear-gradient(90deg,#7c5cff,#9d7cff)' }} /> flight
        </span>
        <span>
          <i className="swatch" style={{ background: 'linear-gradient(180deg,#3ee6d0,#2bb6d6)' }} /> sleep window
        </span>
      </div>

      <AdvicePanel tripId={trip.id} />
    </>
  );
}
