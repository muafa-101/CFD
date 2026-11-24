import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Milestone 2 — Deliverable 1:
 * Integrasi expo-secure-store untuk enkripsi data sensitif (Token/NIK/Kredensial).
 *
 * Menggunakan hardware-backed keystore pada Android (Android Keystore provider)
 * dan Keychain Services pada iOS dengan enkripsi AES-256 / RSA.
 */

export const SECURE_KEYS = {
  AUTH_TOKEN: 'cfd_secure_auth_token',
  USER_NIK: 'cfd_secure_user_nik',
  USER_CREDENTIALS: 'cfd_secure_user_credentials',
} as const;

export interface UserCredentials {
  name: string;
  nik: string; // Nomor Induk Kependudukan (16 digit)
  phone: string;
  token: string; // Auth / Session JWT token
  lastLogin: string;
}

// In-memory fallback untuk web atau environment yang tidak mendukung hardware keystore
const memoryFallback = new Map<string, string>();

/**
 * Memeriksa ketersediaan hardware-backed secure store di perangkat
 */
export async function isSecureStoreSupported(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    return await SecureStore.isAvailableAsync();
  } catch {
    return false;
  }
}

/**
 * Menyimpan data terenkripsi ke hardware-backed SecureStore
 */
export async function saveSecureItem(key: string, value: string): Promise<void> {
  try {
    if (await isSecureStoreSupported()) {
      await SecureStore.setItemAsync(key, value, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
    } else {
      memoryFallback.set(key, value);
    }
  } catch (error) {
    console.warn(`[SecureStore] Gagal menyimpan key "${key}":`, error);
    memoryFallback.set(key, value);
  }
}

/**
 * Membaca data terenkripsi dari hardware-backed SecureStore
 */
export async function getSecureItem(key: string): Promise<string | null> {
  try {
    if (await isSecureStoreSupported()) {
      return await SecureStore.getItemAsync(key);
    }
    return memoryFallback.get(key) ?? null;
  } catch (error) {
    console.warn(`[SecureStore] Gagal membaca key "${key}":`, error);
    return memoryFallback.get(key) ?? null;
  }
}

/**
 * Menghapus data dari SecureStore
 */
export async function deleteSecureItem(key: string): Promise<void> {
  try {
    if (await isSecureStoreSupported()) {
      await SecureStore.deleteItemAsync(key);
    }
    memoryFallback.delete(key);
  } catch (error) {
    console.warn(`[SecureStore] Gagal menghapus key "${key}":`, error);
    memoryFallback.delete(key);
  }
}

/**
 * Menyimpan kredensial lengkap pengguna (Token, NIK, Profile)
 */
export async function saveUserCredentials(credentials: UserCredentials): Promise<void> {
  // Simpan masing-masing untuk granular access dan satu set JSON
  await saveSecureItem(SECURE_KEYS.AUTH_TOKEN, credentials.token);
  await saveSecureItem(SECURE_KEYS.USER_NIK, credentials.nik);
  await saveSecureItem(SECURE_KEYS.USER_CREDENTIALS, JSON.stringify(credentials));
}

/**
 * Mengambil kredensial pengguna terenkripsi
 */
export async function getUserCredentials(): Promise<UserCredentials | null> {
  const json = await getSecureItem(SECURE_KEYS.USER_CREDENTIALS);
  if (!json) return null;
  try {
    return JSON.parse(json) as UserCredentials;
  } catch {
    return null;
  }
}

/**
 * Inisialisasi data default / seed kredensial jika belum ada
 * Berguna saat pertama kali aplikasi dijalankan
 */
export async function initDefaultCredentialsIfNeeded(): Promise<UserCredentials> {
  const existing = await getUserCredentials();
  if (existing) {
    return existing;
  }

  const defaultCreds: UserCredentials = {
    name: 'Iwan Kusnandar',
    nik: '3171012304950001',
    phone: '081234567890',
    token: 'jwt_sec_' + Math.random().toString(36).substring(2, 12) + '_auth',
    lastLogin: new Date().toISOString(),
  };

  await saveUserCredentials(defaultCreds);
  return defaultCreds;
}

/**
 * Sensor / masking helper untuk NIK (misal: 317101******0001)
 */
export function maskNIK(nik: string): string {
  if (!nik || nik.length < 10) return '***';
  return nik.substring(0, 6) + '******' + nik.substring(nik.length - 4);
}

/**
 * Sensor / masking helper untuk Token (misal: jwt_sec_...auth)
 */
export function maskToken(token: string): string {
  if (!token || token.length < 8) return '***';
  return token.substring(0, 8) + '••••••••••••';
}
