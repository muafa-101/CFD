import { useState, useEffect, useRef, useCallback } from 'react';
import * as Location from 'expo-location';

/**
 * Pertemuan 9 - Deliverable #2:
 * Custom Hook useLocationTracking dengan distanceInterval adaptif.
 *
 * Hook ini melakukan:
 * 1. Meminta izin lokasi dari pengguna
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
  startTracking: () => Promise<void>;
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
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);

  // Memulai tracking lokasi
  const startTracking = useCallback(async () => {
    try {
      // Minta izin lokasi foreground
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Izin akses lokasi ditolak. Aktifkan di pengaturan.');
        return;
      }

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
    } catch (error) {
      setErrorMsg('Gagal mengakses lokasi: ' + (error as Error).message);
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
    startTracking,
    stopTracking,
  };
}
