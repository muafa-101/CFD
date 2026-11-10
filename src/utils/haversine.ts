/**
 * Pertemuan 9 - Deliverable #3:
 * Kalkulasi jarak lurus menggunakan Formulasi Haversine.
 *
 * Formula Haversine menghitung jarak antara dua titik pada permukaan bumi
 * berdasarkan koordinat lintang dan bujur, dengan memperhitungkan
 * kelengkungan bumi.
 *
 * Formula:
 *   a = sin²(Δlat/2) + cos(lat1) × cos(lat2) × sin²(Δlon/2)
 *   c = 2 × atan2(√a, √(1−a))
 *   d = R × c
 *
 * Dimana R = 6371 km (radius rata-rata bumi)
 */

// Radius bumi dalam meter
const EARTH_RADIUS_METERS = 6_371_000;

// Konversi derajat ke radian
function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Menghitung jarak antara dua koordinat GPS menggunakan Formula Haversine.
 *
 * @param lat1 - Latitude titik pertama (derajat)
 * @param lon1 - Longitude titik pertama (derajat)
 * @param lat2 - Latitude titik kedua (derajat)
 * @param lon2 - Longitude titik kedua (derajat)
 * @returns Jarak dalam meter
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

/**
 * Memformat jarak ke string yang mudah dibaca.
 * - Di bawah 1000m: tampilkan dalam meter (e.g., "150m")
 * - 1000m ke atas: tampilkan dalam kilometer (e.g., "2.3 km")
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}
