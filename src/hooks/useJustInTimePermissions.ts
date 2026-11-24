import { useState, useCallback } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';

/**
 * Milestone 2 — Deliverable 3:
 * Penanganan Runtime Permissions (Kamera/Lokasi/Storage) berbasis alur Just-In-Time (JIT).
 *
 * Prinsip Alur Just-In-Time:
 * 1. Tidak meminta izin sekaligus di awal (splash/launch).
 * 2. Izin HANYA diminta pada saat pengguna secara eksplisit menekan aksi yang membutuhkan izin terkait.
 * 3. Menampilkan dialog edukasi/rationale sebelum prompt sistem muncul agar pengguna paham konteksnya.
 * 4. Jika pengguna menolak permanen ("Don't ask again"), sediakan opsi langsung ke pengaturan perangkat.
 */

export type PermissionType = 'location' | 'camera' | 'mediaLibrary';

interface PermissionRationale {
  title: string;
  message: string;
  icon: string;
}

const RATIONALES: Record<PermissionType, PermissionRationale> = {
  location: {
    title: 'Izin Akses Lokasi (GPS)',
    message:
      'Aplikasi memerlukan akses lokasi Anda secara tepat untuk menyematkan koordinat kejadian pada laporan serta mengukur jarak ke lokasi lain.',
    icon: '📍',
  },
  camera: {
    title: 'Izin Akses Kamera',
    message:
      'Aplikasi memerlukan akses kamera untuk mengambil foto bukti kerusakan atau kejadian secara langsung di tempat.',
    icon: '📷',
  },
  mediaLibrary: {
    title: 'Izin Galeri / Media Storage',
    message:
      'Aplikasi memerlukan akses penyimpanan media untuk memilih foto bukti kejadian yang sudah ada di galeri perangkat Anda.',
    icon: '🖼️',
  },
};

export function useJustInTimePermissions() {
  const [isRequesting, setIsRequesting] = useState(false);

  /**
   * Dialog penanganan jika izin diblokir permanen oleh sistem
   */
  const showSettingsRedirectAlert = useCallback((type: PermissionType) => {
    const rationale = RATIONALES[type];
    Alert.alert(
      `${rationale.icon} Izin Diperlukan`,
      `${rationale.message}\n\nIzin ini sebelumnya telah ditolak. Silakan aktifkan melalui Pengaturan Perangkat Anda.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Buka Pengaturan',
          style: 'default',
          onPress: () => {
            if (Platform.OS !== 'web') {
              Linking.openSettings();
            }
          },
        },
      ]
    );
  }, []);

  /**
   * Menampilkan rationale dialog Just-In-Time sebelum meminta izin OS
   */
  const confirmRationale = useCallback(
    (type: PermissionType): Promise<boolean> => {
      const rationale = RATIONALES[type];
      return new Promise((resolve) => {
        Alert.alert(
          `${rationale.icon} ${rationale.title}`,
          rationale.message,
          [
            {
              text: 'Nanti Saja',
              style: 'cancel',
              onPress: () => resolve(false),
            },
            {
              text: 'Lanjutkan',
              style: 'default',
              onPress: () => resolve(true),
            },
          ],
          { cancelable: true, onDismiss: () => resolve(false) }
        );
      });
    },
    []
  );

  /**
   * Request Izin Lokasi secara Just-In-Time
   */
  const requestLocationJIT = useCallback(
    async (showRationale = true): Promise<boolean> => {
      setIsRequesting(true);
      try {
        // Cek status saat ini terlebih dahulu
        const current = await Location.getForegroundPermissionsAsync();
        if (current.status === 'granted') {
          return true;
        }

        // Tampilkan edukasi rationale JIT jika belum granted
        if (showRationale) {
          const proceed = await confirmRationale('location');
          if (!proceed) return false;
        }

        // Minta izin ke sistem OS
        const result = await Location.requestForegroundPermissionsAsync();
        if (result.status === 'granted') {
          return true;
        }

        if (!result.canAskAgain) {
          showSettingsRedirectAlert('location');
        }
        return false;
      } catch (error) {
        console.error('[JIT Permission] Error requesting location:', error);
        return false;
      } finally {
        setIsRequesting(false);
      }
    },
    [confirmRationale, showSettingsRedirectAlert]
  );

  /**
   * Request Izin Kamera secara Just-In-Time
   */
  const requestCameraJIT = useCallback(
    async (showRationale = true): Promise<boolean> => {
      setIsRequesting(true);
      try {
        const current = await ImagePicker.getCameraPermissionsAsync();
        if (current.status === 'granted') {
          return true;
        }

        if (showRationale) {
          const proceed = await confirmRationale('camera');
          if (!proceed) return false;
        }

        const result = await ImagePicker.requestCameraPermissionsAsync();
        if (result.status === 'granted') {
          return true;
        }

        if (!result.canAskAgain) {
          showSettingsRedirectAlert('camera');
        }
        return false;
      } catch (error) {
        console.error('[JIT Permission] Error requesting camera:', error);
        return false;
      } finally {
        setIsRequesting(false);
      }
    },
    [confirmRationale, showSettingsRedirectAlert]
  );

  /**
   * Request Izin Media Library / Storage secara Just-In-Time
   */
  const requestMediaLibraryJIT = useCallback(
    async (showRationale = true): Promise<boolean> => {
      setIsRequesting(true);
      try {
        const current = await ImagePicker.getMediaLibraryPermissionsAsync();
        if (current.status === 'granted') {
          return true;
        }

        if (showRationale) {
          const proceed = await confirmRationale('mediaLibrary');
          if (!proceed) return false;
        }

        const result = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (result.status === 'granted') {
          return true;
        }

        if (!result.canAskAgain) {
          showSettingsRedirectAlert('mediaLibrary');
        }
        return false;
      } catch (error) {
        console.error('[JIT Permission] Error requesting media library:', error);
        return false;
      } finally {
        setIsRequesting(false);
      }
    },
    [confirmRationale, showSettingsRedirectAlert]
  );

  return {
    isRequesting,
    requestLocationJIT,
    requestCameraJIT,
    requestMediaLibraryJIT,
  };
}
