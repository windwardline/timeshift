import { describe, it, expect, beforeEach, vi } from 'vitest';

// US-B1/C1 route wiring: POST /api/trips validates + normalizes the body (real
// normalizeTripInput) and persists via createTrip (mocked). Invalid input is
// rejected before any write.
const mocks = vi.hoisted(() => ({ upsert: vi.fn(), createTrip: vi.fn() }));

vi.mock('@/lib/db/prisma', () => ({ prisma: { user: { upsert: mocks.upsert } } }));
vi.mock('@/lib/db/trips', () => ({ createTrip: mocks.createTrip }));

import { POST } from './route';

const validLeg = {
  departureAirport: 'JFK',
  arrivalAirport: 'LHR',
  departureLocal: '2025-06-01T18:00',
  arrivalLocal: '2025-06-02T06:00',
  departureTz: 'America/New_York',
  arrivalTz: 'Europe/London',
};

function post(body: unknown) {
  return POST(
    new Request('http://localhost/api/trips', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  );
}

describe('POST /api/trips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.upsert.mockResolvedValue({ id: 'u1' });
    mocks.createTrip.mockResolvedValue({ id: 'new-trip' });
  });

  it('creates a trip from valid input and returns its id', async () => {
    const res = await post({ name: 'NYC → London', segments: [validLeg] });

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: 'new-trip' });
    // normalized to UTC before persistence
    const arg = mocks.createTrip.mock.calls[0][0];
    expect(arg.destination).toBe('Europe/London');
    expect(arg.segments[0].departureTime.toISOString()).toBe('2025-06-01T22:00:00.000Z');
  });

  it('rejects an impossible leg with 400 and never writes', async () => {
    const res = await post({
      name: 'Impossible',
      segments: [{ ...validLeg, arrivalLocal: '2025-06-01T17:00' }],
    });

    expect(res.status).toBe(400);
    expect(mocks.createTrip).not.toHaveBeenCalled();
  });
});
