import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

/**
 * Milestone 2 — Deliverable 2:
 * Integrasi expo-file-system (documentDirectory) untuk penanganan dokumen/media sandbox.
 *
 * Menerapkan prinsip Scoped Storage & Offline-First:
 * 1. Seluruh media laporan (foto kamera / galeri) disalin ke sandbox lokal (documentDirectory).
 * 2. Laporan kejadian disimpan secara lokal dalam file JSON di sandbox (Offline-First).
 * 3. Media tidak bergantung pada cache sementara (cacheDirectory) yang bisa terhapus oleh OS.
 */

// Root direktori sandbox dalam documentDirectory
const DOC_DIR = FileSystem.documentDirectory ?? '';
export const SANDBOX_MEDIA_DIR = `${DOC_DIR}cfd_sandbox/media/`;
export const SANDBOX_DOCS_DIR = `${DOC_DIR}cfd_sandbox/docs/`;
export const SANDBOX_REPORTS_FILE = `${DOC_DIR}cfd_sandbox/offline_reports.json`;

export interface LocalReport {
  id: string;
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  createdAt: string; // ISO string
  mediaUri?: string; // URI file di dalam sandbox (documentDirectory)
  mediaFilename?: string;
  mediaSize?: number;
  authorNIKMasked?: string;
  isOffline: boolean;
}

export interface SandboxStats {
  mediaCount: number;
  totalSizeBytes: number;
  sandboxPath: string;
}

// In-memory fallback untuk web
let webOfflineReports: LocalReport[] = [];

/**
 * Memastikan direktori sandbox di dalam documentDirectory sudah dibuat
 */
export async function ensureSandboxDirectories(): Promise<void> {
  if (Platform.OS === 'web' || !DOC_DIR) return;

  try {
    const mediaDirInfo = await FileSystem.getInfoAsync(SANDBOX_MEDIA_DIR);
    if (!mediaDirInfo.exists) {
      await FileSystem.makeDirectoryAsync(SANDBOX_MEDIA_DIR, { intermediates: true });
    }

    const docsDirInfo = await FileSystem.getInfoAsync(SANDBOX_DOCS_DIR);
    if (!docsDirInfo.exists) {
      await FileSystem.makeDirectoryAsync(SANDBOX_DOCS_DIR, { intermediates: true });
    }
  } catch (error) {
    console.error('[SandboxStorage] Gagal inisialisasi direktori sandbox:', error);
  }
}

/**
 * Menyimpan media foto/dokumen ke dalam Scoped Storage (documentDirectory)
 * @param sourceUri URI sementara dari kamera atau galeri
 * @returns Object berisi URI lokal di sandbox, nama file, dan ukuran file
 */
export async function saveMediaToSandbox(
  sourceUri: string
): Promise<{ uri: string; filename: string; size: number }> {
  if (Platform.OS === 'web' || !DOC_DIR) {
    return { uri: sourceUri, filename: 'web_media.jpg', size: 0 };
  }

  await ensureSandboxDirectories();

  // Ekstrak ekstensi file atau default ke .jpg
  const extension = sourceUri.split('.').pop()?.split('?')[0] ?? 'jpg';
  const filename = `media_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${extension}`;
  const destinationUri = `${SANDBOX_MEDIA_DIR}${filename}`;

  try {
    // Salin file dari source (kamera/galeri cache) ke Scoped Storage tetap
    await FileSystem.copyAsync({
      from: sourceUri,
      to: destinationUri,
    });

    const fileInfo = await FileSystem.getInfoAsync(destinationUri);
    const size = fileInfo.exists && !fileInfo.isDirectory ? fileInfo.size ?? 0 : 0;

    return {
      uri: destinationUri,
      filename,
      size,
    };
  } catch (error) {
    console.error('[SandboxStorage] Gagal menyalin media ke sandbox:', error);
    // Jika gagal copy, fallback ke sourceUri
    return { uri: sourceUri, filename, size: 0 };
  }
}

/**
 * Mengambil daftar seluruh file media yang ada di sandbox
 */
export async function listSandboxMedia(): Promise<string[]> {
  if (Platform.OS === 'web' || !DOC_DIR) return [];

  try {
    await ensureSandboxDirectories();
    return await FileSystem.readDirectoryAsync(SANDBOX_MEDIA_DIR);
  } catch (error) {
    console.error('[SandboxStorage] Gagal membaca direktori media sandbox:', error);
    return [];
  }
}

/**
 * Menghapus file media dari sandbox
 */
export async function deleteMediaFromSandbox(fileUri: string): Promise<boolean> {
  if (Platform.OS === 'web' || !DOC_DIR) return true;

  try {
    const info = await FileSystem.getInfoAsync(fileUri);
    if (info.exists) {
      await FileSystem.deleteAsync(fileUri, { idempotent: true });
      return true;
    }
    return false;
  } catch (error) {
    console.error('[SandboxStorage] Gagal menghapus file dari sandbox:', error);
    return false;
  }
}

/**
 * Menyimpan laporan baru ke file JSON sandbox (Offline-First Architecture)
 */
export async function saveReportOffline(report: LocalReport): Promise<void> {
  if (Platform.OS === 'web' || !DOC_DIR) {
    webOfflineReports = [report, ...webOfflineReports];
    return;
  }

  await ensureSandboxDirectories();

  try {
    const existingReports = await getOfflineReports();
    const updatedReports = [report, ...existingReports];

    await FileSystem.writeAsStringAsync(
      SANDBOX_REPORTS_FILE,
      JSON.stringify(updatedReports, null, 2),
      { encoding: FileSystem.EncodingType.UTF8 }
    );
  } catch (error) {
    console.error('[SandboxStorage] Gagal menyimpan laporan offline ke sandbox:', error);
  }
}

/**
 * Membaca semua laporan yang tersimpan secara offline di sandbox
 */
export async function getOfflineReports(): Promise<LocalReport[]> {
  if (Platform.OS === 'web' || !DOC_DIR) {
    return webOfflineReports;
  }

  try {
    await ensureSandboxDirectories();
    const info = await FileSystem.getInfoAsync(SANDBOX_REPORTS_FILE);
    if (!info.exists) {
      return [];
    }

    const content = await FileSystem.readAsStringAsync(SANDBOX_REPORTS_FILE, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    return JSON.parse(content) as LocalReport[];
  } catch (error) {
    console.error('[SandboxStorage] Gagal membaca laporan offline dari sandbox:', error);
    return [];
  }
}

/**
 * Mendapatkan statistik penyimpanan sandbox untuk transparansi pengguna
 */
export async function getSandboxStats(): Promise<SandboxStats> {
  const defaultStats: SandboxStats = {
    mediaCount: 0,
    totalSizeBytes: 0,
    sandboxPath: DOC_DIR,
  };

  if (Platform.OS === 'web' || !DOC_DIR) return defaultStats;

  try {
    await ensureSandboxDirectories();
    const files = await FileSystem.readDirectoryAsync(SANDBOX_MEDIA_DIR);
    let totalSize = 0;

    for (const filename of files) {
      const info = await FileSystem.getInfoAsync(`${SANDBOX_MEDIA_DIR}${filename}`);
      if (info.exists && !info.isDirectory) {
        totalSize += info.size ?? 0;
      }
    }

    return {
      mediaCount: files.length,
      totalSizeBytes: totalSize,
      sandboxPath: SANDBOX_MEDIA_DIR,
    };
  } catch (error) {
    console.error('[SandboxStorage] Gagal menghitung statistik sandbox:', error);
    return defaultStats;
  }
}

/**
 * Format ukuran byte ke unit yang mudah dibaca (KB / MB)
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}
