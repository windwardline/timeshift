import { describe, it, expect } from 'vitest';
import { parseFlights } from './parse';

// Maps AviationStack `/flights` JSON into FlightOption[] (spec §4). Wall-time
// locals come from each end's zone; duration is the true UTC elapsed time, so an
// IDL flight is still positive. Malformed/incomplete entries are dropped, never
// thrown on.

const sample = {
  data: [
    {
      flight_status: 'scheduled',
      departure: { airport: 'John F Kennedy', timezone: 'America/New_York', iata: 'JFK', terminal: '7', scheduled: '2025-07-01T21:30:00-04:00' },
      arrival: { airport: 'Heathrow', timezone: 'Europe/London', iata: 'LHR', terminal: '5', scheduled: '2025-07-02T09:20:00+01:00' },
      airline: { name: 'British Airways', iata: 'BA' },
      flight: { number: '178', iata: 'BA178' },
    },
    {
      flight_status: 'scheduled',
      departure: { airport: 'Heathrow', timezone: 'Europe/London', iata: 'LHR', terminal: '5', scheduled: '2025-07-02T11:40:00+01:00' },
      arrival: { airport: 'Changi', timezone: 'Asia/Singapore', iata: 'SIN', terminal: '1', scheduled: '2025-07-03T07:30:00+08:00' },
      airline: { name: 'British Airways', iata: 'BA' },
      flight: { number: '11', iata: 'BA11' },
    },
  ],
};

describe('parseFlights', () => {
  it('maps each entry to a FlightOption with wall-time locals and true duration', () => {
    const out = parseFlights(sample);
    expect(out).toHaveLength(2);

    const ba178 = out[0];
    expect(ba178.flightNumber).toBe('BA 178');
    expect(ba178.airlineName).toBe('British Airways');
    expect(ba178.departureIata).toBe('JFK');
    expect(ba178.arrivalIata).toBe('LHR');
    expect(ba178.departureLocal).toBe('2025-07-01T21:30'); // wall time at JFK
    expect(ba178.arrivalLocal).toBe('2025-07-02T09:20'); // wall time at LHR
    expect(ba178.departureTz).toBe('America/New_York');
    expect(ba178.arrivalTz).toBe('Europe/London');
    expect(ba178.departureTerminal).toBe('7');
    expect(ba178.arrivalTerminal).toBe('5');
    // 01:30Z → 08:20Z = 6h50m
    expect(ba178.durationMinutes).toBe(410);
  });

  it('keeps duration positive across the date line', () => {
    const idl = {
      data: [
        {
          departure: { timezone: 'Asia/Tokyo', iata: 'HND', scheduled: '2025-07-02T17:00:00+09:00' },
          arrival: { timezone: 'America/Los_Angeles', iata: 'LAX', scheduled: '2025-07-02T10:00:00-07:00' },
          airline: { name: 'JAL', iata: 'JL' },
          flight: { number: '62', iata: 'JL62' },
        },
      ],
    };
    const [opt] = parseFlights(idl);
    expect(opt.arrivalLocal < opt.departureLocal).toBe(true); // naive clock looks earlier
    expect(opt.durationMinutes).toBeGreaterThan(0); // but real elapsed time is positive
    expect(opt.durationMinutes).toBe(540); // 9h
  });

  it('drops entries missing required fields', () => {
    const partial = {
      data: [
        { departure: { timezone: 'Europe/London', iata: 'LHR', scheduled: '2025-07-02T11:40:00+01:00' }, arrival: { timezone: 'Asia/Singapore', iata: 'SIN' /* no scheduled */ }, flight: { number: '11' } },
      ],
    };
    expect(parseFlights(partial)).toEqual([]);
  });

  it('returns [] for malformed roots instead of throwing', () => {
    expect(parseFlights(null)).toEqual([]);
    expect(parseFlights({})).toEqual([]);
    expect(parseFlights({ data: 'nope' })).toEqual([]);
  });
});
