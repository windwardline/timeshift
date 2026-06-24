import { DateTime } from 'luxon';
import { resolveCoords } from './coords';
import type { FlightOption } from './types';

// Map AviationStack `/flights` JSON into FlightOption[]. PURE and defensive: any
// entry missing a required field is dropped, and a malformed root yields []
// rather than throwing (the route turns upstream trouble into a 502, never a crash).

interface RawEnd {
  timezone?: unknown;
  iata?: unknown;
  terminal?: unknown;
  scheduled?: unknown;
}
interface RawFlight {
  departure?: RawEnd;
  arrival?: RawEnd;
  airline?: { name?: unknown; iata?: unknown };
  flight?: { number?: unknown; iata?: unknown };
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null);

// "YYYY-MM-DDTHH:mm" wall time at `tz` from an ISO instant that carries its offset.
function wallTime(scheduled: string, tz: string): string {
  return DateTime.fromISO(scheduled, { setZone: true }).setZone(tz).toFormat("yyyy-MM-dd'T'HH:mm");
}

function toOption(raw: RawFlight): FlightOption | null {
  const dep = raw.departure ?? {};
  const arr = raw.arrival ?? {};
  const depTz = str(dep.timezone);
  const arrTz = str(arr.timezone);
  const depIata = str(dep.iata);
  const arrIata = str(arr.iata);
  const depSched = str(dep.scheduled);
  const arrSched = str(arr.scheduled);
  const numberPart = str(raw.flight?.number);
  const iataCode = str(raw.flight?.iata);

  // A leg is usable only with both zones, both airports, both times, and a flight
  // identifier. Any missing field drops the entry (one guard, not a chain).
  if ([depTz, arrTz, depIata, arrIata, depSched, arrSched, numberPart ?? iataCode].some((v) => !v)) {
    return null;
  }

  const depInstant = DateTime.fromISO(depSched!, { setZone: true });
  const arrInstant = DateTime.fromISO(arrSched!, { setZone: true });
  if (!depInstant.isValid || !arrInstant.isValid) return null;

  const airlineIata = str(raw.airline?.iata);
  // "BA 178" when we have the airline + numeric; else the raw IATA code ("BA178").
  const flightNumber = airlineIata && numberPart ? `${airlineIata} ${numberPart}` : (iataCode ?? numberPart!);

  const depCoords = resolveCoords(depIata!);
  const arrCoords = resolveCoords(arrIata!);

  return {
    flightNumber,
    airlineName: str(raw.airline?.name),
    departureIata: depIata!.toUpperCase(),
    arrivalIata: arrIata!.toUpperCase(),
    departureLocal: wallTime(depSched!, depTz!),
    arrivalLocal: wallTime(arrSched!, arrTz!),
    departureTz: depTz!,
    arrivalTz: arrTz!,
    departureTerminal: str(dep.terminal),
    arrivalTerminal: str(arr.terminal),
    durationMinutes: Math.round(arrInstant.diff(depInstant, 'minutes').minutes),
    departureLat: depCoords?.lat ?? null,
    departureLng: depCoords?.lng ?? null,
    arrivalLat: arrCoords?.lat ?? null,
    arrivalLng: arrCoords?.lng ?? null,
  };
}

export function parseFlights(raw: unknown): FlightOption[] {
  const data = (raw as { data?: unknown } | null)?.data;
  if (!Array.isArray(data)) return [];
  return data.map((entry) => toOption(entry as RawFlight)).filter((o): o is FlightOption => o !== null);
}
