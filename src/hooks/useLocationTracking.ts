import { useState, useEffect, useRef, useCallback } from 'react';
import * as Location from 'expo-location';

/**
 * Pertemuan 9 - Deliverable #2 & Pertemuan 10 Milestone 2:
 * Custom Hook useLocationTracking dengan distanceInterval adaptif
 * dan integrasi status izin Just-In-Time.
 *
 * Hook ini melakukan:
 * 1. Memeriksa & meminta izin lokasi foreground pengguna (alur JIT)
 * 2. Melacak lokasi pengguna secara real-time
 * 3. Menggunakan distanceInterval adaptif berdasarkan kecepatan pengguna:
 *    - Diam (speed < 1 m/s): distanceInterval = 10m (hemat baterai)
 *    - Berjalan (1-5 m/s): distanceInterval = 5m
 *    - Berkendara (> 5 m/s): distanceInterval = 2m (update lebih sering)
 */

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  timestamp: number;
}

interface UseLocationTrackingResult {
  location: LocationData | null;
  errorMsg: string | null;
  isTracking: boolean;
  distanceInterval: number;
  permissionStatus: Location.PermissionStatus | 'undetermined';
  startTracking: () => Promise<boolean>;
  stopTracking: () => void;
}

// Fungsi untuk menentukan distanceInterval adaptif berdasarkan kecepatan
function getAdaptiveDistanceInterval(speed: number | null): number {
  if (speed === null || speed < 1) {
    // Diam atau kecepatan sangat rendah -> update jarang (hemat baterai)
    return 10;
  } else if (speed < 5) {
    // Berjalan kaki -> update sedang
    return 5;
  } else {
    // Berkendara -> update sering
    return 2;
  }
}

export function useLocationTracking(): UseLocationTrackingResult {
  const [location, setLocation] = useState<LocationData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [distanceInterval, setDistanceInterval] = useState(10);
  const [permissionStatus, setPermissionStatus] = useState<
    Location.PermissionStatus | 'undetermined'
  >('undetermined');
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);

  // Periksa status izin saat inisialisasi tanpa langsung memunculkan dialog OS
  useEffect(() => {
    Location.getForegroundPermissionsAsync()
      .then((res) => {
        setPermissionStatus(res.status);
      })
      .catch(() => {});
  }, []);

  // Memulai tracking lokasi
  const startTracking = useCallback(async (): Promise<boolean> => {
    try {
      // Periksa status izin saat ini
      let { status } = await Location.getForegroundPermissionsAsync();
      if (status !== Location.PermissionStatus.GRANTED) {
        const req = await Location.requestForegroundPermissionsAsync();
        status = req.status;
      }

      setPermissionStatus(status);

      if (status !== Location.PermissionStatus.GRANTED) {
        setErrorMsg('Izin akses lokasi ditolak. Tekan untuk mengaktifkan.');
        return false;
      }

      setErrorMsg(null);

      // Ambil lokasi awal
      const initialLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const initialData: LocationData = {
        latitude: initialLocation.coords.latitude,
        longitude: initialLocation.coords.longitude,
        accuracy: initialLocation.coords.accuracy,
        speed: initialLocation.coords.speed,
        heading: initialLocation.coords.heading,
        timestamp: initialLocation.timestamp,
      };

      setLocation(initialData);
      setIsTracking(true);

      // Tentukan distanceInterval awal berdasarkan speed
      const initialInterval = getAdaptiveDistanceInterval(initialLocation.coords.speed);
      setDistanceInterval(initialInterval);

      // Bersihkan subscription sebelumnya jika ada
      if (subscriptionRef.current) {
        subscriptionRef.current.remove();
      }

      // Subscribe ke perubahan lokasi dengan distanceInterval adaptif
      subscriptionRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 3000, // Minimum 3 detik antar update
          distanceInterval: initialInterval, // distanceInterval adaptif
        },
        (newLocation) => {
          const newData: LocationData = {
            latitude: newLocation.coords.latitude,
            longitude: newLocation.coords.longitude,
            accuracy: newLocation.coords.accuracy,
            speed: newLocation.coords.speed,
            heading: newLocation.coords.heading,
            timestamp: newLocation.timestamp,
          };

          setLocation(newData);

          // Update distanceInterval berdasarkan kecepatan terbaru
          const newInterval = getAdaptiveDistanceInterval(newLocation.coords.speed);
          setDistanceInterval(newInterval);
        }
      );

      return true;
    } catch (error) {
      const msg = (error as Error).message;
      setErrorMsg('Gagal mengakses lokasi: ' + msg);
      return false;
    }
  }, []);

  // Menghentikan tracking lokasi
  const stopTracking = useCallback(() => {
    if (subscriptionRef.current) {
      subscriptionRef.current.remove();
      subscriptionRef.current = null;
    }
    setIsTracking(false);
  }, []);

  // Cleanup saat unmount
  useEffect(() => {
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.remove();
      }
    };
  }, []);

  return {
    location,
    errorMsg,
    isTracking,
    distanceInterval,
    permissionStatus,
    startTracking,
    stopTracking,
  };
}
