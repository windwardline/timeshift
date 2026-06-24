/* v8 ignore file */
// The ONLY module in lib/flights that touches the network/API key (CLAUDE.md
// §13). Never unit-tested and explicitly excluded from coverage — it is
// exercised live only in the demo with a real key. Everything else in
// lib/flights/ is pure and TDD'd against this interface's mock.
//
// Provider: AviationStack `/flights` endpoint. The free tier is HTTP-only; the
// key is read server-side (the route passes it in from process.env) and never
// reaches the browser. Documented limitation — a paid HTTPS plan is recommended
// for production.

const BASE = 'http://api.aviationstack.com/v1/flights';

export interface FlightClient {
  searchFlights(params: { from: string; to: string; date: string }): Promise<unknown>;
  flightStatus(params: { flight: string; date: string }): Promise<unknown>;
}

async function getJson(url: URL): Promise<unknown> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    throw new Error(`AviationStack request failed (${res.status})`);
  }
  return res.json();
}

export function createFlightClient(apiKey: string): FlightClient {
  // NOTE: the `flight_date` parameter (historical/future schedule lookup) is a
  // PAID AviationStack function — the free plan returns `function_access_restricted`
  // (403) when it's present. We therefore query the free real-time feed (current
  // day's live schedule for the route), which carries the same fields we need
  // (scheduled times, IANA zones, terminals). `date` is still used upstream for
  // validation, the cache key, and the leg the builder fills. To enable true
  // future-dated search, add `flight_date` back on a paid plan.
  return {
    searchFlights({ from, to }) {
      const url = new URL(BASE);
      url.searchParams.set('access_key', apiKey);
      url.searchParams.set('dep_iata', from);
      url.searchParams.set('arr_iata', to);
      return getJson(url);
    },
    flightStatus({ flight }) {
      const url = new URL(BASE);
      url.searchParams.set('access_key', apiKey);
      url.searchParams.set('flight_iata', flight.replace(/\s+/g, ''));
      return getJson(url);
    },
  };
}
