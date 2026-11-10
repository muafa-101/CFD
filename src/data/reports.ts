/**
 * Data dummy untuk laporan kejadian di kota.
 * Digunakan sebagai contoh tampilan di landing page.
 */

export interface Report {
  id: string;
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  createdAt: Date;
  imageUri?: string;
}

// Data laporan dummy — lokasi di sekitar Jakarta
export const DUMMY_REPORTS: Report[] = [
  {
    id: '1',
    title: 'Pohon Rubuh',
    description: 'Pohon besar tumbang menghalangi jalan utama di depan kantor kecamatan.',
    latitude: -6.2088,
    longitude: 106.8456,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 jam lalu
  },
  {
    id: '2',
    title: 'Kebakaran',
    description: 'Kebakaran terjadi di pemukiman padat penduduk, api berasal dari konsleting listrik.',
    latitude: -6.2120,
    longitude: 106.8500,
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Kemarin
  },
  {
    id: '3',
    title: 'Jembatan Rubuh',
    description: 'Jembatan penyeberangan pejalan kaki rubuh akibat hujan deras semalam.',
    latitude: -6.2050,
    longitude: 106.8430,
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 hari lalu
  },
];

/**
 * Memformat waktu relatif dari tanggal pembuatan laporan.
 */
export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return 'Baru saja';
  if (diffMinutes < 60) return `${diffMinutes} menit yang lalu`;
  if (diffHours < 24) return `${diffHours} jam yang lalu`;
  if (diffDays === 1) return 'Kemarin';
  if (diffDays < 7) return `${diffDays} hari yang lalu`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} minggu yang lalu`;
  return `${Math.floor(diffDays / 30)} bulan yang lalu`;
}
