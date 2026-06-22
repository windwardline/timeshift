// A curated set of major international airports so the trip builder is a clean
// picker rather than free-text. Each entry carries the IANA timezone and
// coordinates, so choosing an airport gives the engine everything it needs:
// the zone for offset/DST (Luxon) and lat/lng for day/night arcs (SunCalc).

export interface Airport {
  iata: string;
  city: string;
  name: string;
  tz: string;
  lat: number;
  lng: number;
}

export const AIRPORTS: Airport[] = [
  { iata: 'JFK', city: 'New York', name: 'John F. Kennedy', tz: 'America/New_York', lat: 40.6413, lng: -73.7781 },
  { iata: 'EWR', city: 'Newark', name: 'Newark Liberty', tz: 'America/New_York', lat: 40.6895, lng: -74.1745 },
  { iata: 'LAX', city: 'Los Angeles', name: 'Los Angeles Intl', tz: 'America/Los_Angeles', lat: 33.9416, lng: -118.4085 },
  { iata: 'SFO', city: 'San Francisco', name: 'San Francisco Intl', tz: 'America/Los_Angeles', lat: 37.6213, lng: -122.379 },
  { iata: 'ORD', city: 'Chicago', name: "O'Hare Intl", tz: 'America/Chicago', lat: 41.9742, lng: -87.9073 },
  { iata: 'DFW', city: 'Dallas', name: 'Dallas/Fort Worth', tz: 'America/Chicago', lat: 32.8998, lng: -97.0403 },
  { iata: 'YYZ', city: 'Toronto', name: 'Toronto Pearson', tz: 'America/Toronto', lat: 43.6777, lng: -79.6248 },
  { iata: 'MEX', city: 'Mexico City', name: 'Benito Juárez', tz: 'America/Mexico_City', lat: 19.4361, lng: -99.0719 },
  { iata: 'GRU', city: 'São Paulo', name: 'Guarulhos', tz: 'America/Sao_Paulo', lat: -23.4356, lng: -46.4731 },
  { iata: 'LHR', city: 'London', name: 'Heathrow', tz: 'Europe/London', lat: 51.47, lng: -0.4543 },
  { iata: 'CDG', city: 'Paris', name: 'Charles de Gaulle', tz: 'Europe/Paris', lat: 49.0097, lng: 2.5479 },
  { iata: 'AMS', city: 'Amsterdam', name: 'Schiphol', tz: 'Europe/Amsterdam', lat: 52.3105, lng: 4.7683 },
  { iata: 'FRA', city: 'Frankfurt', name: 'Frankfurt am Main', tz: 'Europe/Berlin', lat: 50.0379, lng: 8.5622 },
  { iata: 'MAD', city: 'Madrid', name: 'Barajas', tz: 'Europe/Madrid', lat: 40.4983, lng: -3.5676 },
  { iata: 'FCO', city: 'Rome', name: 'Fiumicino', tz: 'Europe/Rome', lat: 41.8003, lng: 12.2389 },
  { iata: 'IST', city: 'Istanbul', name: 'Istanbul Airport', tz: 'Europe/Istanbul', lat: 41.2753, lng: 28.7519 },
  { iata: 'DXB', city: 'Dubai', name: 'Dubai Intl', tz: 'Asia/Dubai', lat: 25.2532, lng: 55.3657 },
  { iata: 'DOH', city: 'Doha', name: 'Hamad Intl', tz: 'Asia/Qatar', lat: 25.2731, lng: 51.608 },
  { iata: 'DEL', city: 'Delhi', name: 'Indira Gandhi', tz: 'Asia/Kolkata', lat: 28.5562, lng: 77.1 },
  { iata: 'BOM', city: 'Mumbai', name: 'Chhatrapati Shivaji', tz: 'Asia/Kolkata', lat: 19.0896, lng: 72.8656 },
  { iata: 'BKK', city: 'Bangkok', name: 'Suvarnabhumi', tz: 'Asia/Bangkok', lat: 13.69, lng: 100.7501 },
  { iata: 'SIN', city: 'Singapore', name: 'Changi', tz: 'Asia/Singapore', lat: 1.3644, lng: 103.9915 },
  { iata: 'HKG', city: 'Hong Kong', name: 'Hong Kong Intl', tz: 'Asia/Hong_Kong', lat: 22.308, lng: 113.9185 },
  { iata: 'ICN', city: 'Seoul', name: 'Incheon', tz: 'Asia/Seoul', lat: 37.4602, lng: 126.4407 },
  { iata: 'HND', city: 'Tokyo', name: 'Haneda', tz: 'Asia/Tokyo', lat: 35.5494, lng: 139.7798 },
  { iata: 'NRT', city: 'Tokyo', name: 'Narita', tz: 'Asia/Tokyo', lat: 35.772, lng: 140.3929 },
  { iata: 'SYD', city: 'Sydney', name: 'Kingsford Smith', tz: 'Australia/Sydney', lat: -33.9399, lng: 151.1753 },
  { iata: 'MEL', city: 'Melbourne', name: 'Melbourne Airport', tz: 'Australia/Melbourne', lat: -37.6733, lng: 144.8433 },
  { iata: 'AKL', city: 'Auckland', name: 'Auckland Airport', tz: 'Pacific/Auckland', lat: -37.0082, lng: 174.785 },
  { iata: 'JNB', city: 'Johannesburg', name: 'O. R. Tambo', tz: 'Africa/Johannesburg', lat: -26.1392, lng: 28.246 },
];

export function findAirport(iata: string): Airport | undefined {
  return AIRPORTS.find((a) => a.iata === iata);
}
