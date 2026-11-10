import { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Platform,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { router } from "expo-router";
import { useLocationTracking } from "@/hooks/useLocationTracking";
import { haversineDistance, formatDistance } from "@/utils/haversine";
import { DUMMY_REPORTS, formatRelativeTime } from "@/data/reports";

const { width } = Dimensions.get("window");

/**
 * Landing Page - Halaman utama aplikasi pelaporan kerusakan kota.
 *
 * Pertemuan 9 Implementation:
 * 1. Konfigurasi react-native-maps & expo-location ✓
 * 2. Custom Hook useLocationTracking dengan distanceInterval adaptif ✓
 * 3. Custom Markers & kalkulasi jarak lurus (Haversine) ✓
 */
export default function LandingPage() {
  const { location, errorMsg, isTracking, distanceInterval, startTracking } =
    useLocationTracking();

  // Mulai tracking lokasi saat halaman dimuat
  useEffect(() => {
    startTracking();
  }, [startTracking]);

  // Hitung jarak dari user ke setiap laporan menggunakan Haversine
  const reportsWithDistance = DUMMY_REPORTS.map((report) => {
    const distance =
      location
        ? haversineDistance(
            location.latitude,
            location.longitude,
            report.latitude,
            report.longitude
          )
        : null;
    return { ...report, distance };
  });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* ===== Informasi User ===== */}
      <View style={styles.userCard}>
        <View style={styles.userAvatar}>
          <Text style={styles.userAvatarText}>👤</Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>Iwan Kusnandar</Text>
          {isTracking && (
            <Text style={styles.trackingBadge}>
              📍 GPS Aktif • Interval: {distanceInterval}m
            </Text>
          )}
        </View>
      </View>

      {/* ===== Peta Lokasi User (react-native-maps) ===== */}
      <View style={styles.mapContainer}>
        {location ? (
          <MapView
            style={styles.map}
            provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
            initialRegion={{
              latitude: location.latitude,
              longitude: location.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }}
            region={{
              latitude: location.latitude,
              longitude: location.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }}
            showsUserLocation
            showsMyLocationButton
          >
            {/* Custom Markers untuk setiap laporan (Deliverable #3) */}
            {DUMMY_REPORTS.map((report) => (
              <Marker
                key={report.id}
                coordinate={{
                  latitude: report.latitude,
                  longitude: report.longitude,
                }}
                title={report.title}
                description={report.description}
                pinColor="#e74c3c"
              />
            ))}
          </MapView>
        ) : (
          <View style={styles.mapPlaceholder}>
            {errorMsg ? (
              <Text style={styles.errorText}>⚠️ {errorMsg}</Text>
            ) : (
              <>
                <ActivityIndicator size="large" color="#5ba4c9" />
                <Text style={styles.loadingText}>Memuat lokasi...</Text>
              </>
            )}
          </View>
        )}
      </View>

      {/* ===== Informasi Tracking (Debug) ===== */}
      {location && (
        <View style={styles.locationDebug}>
          <Text style={styles.debugText}>
            📍 {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
          </Text>
          <Text style={styles.debugText}>
            🎯 Akurasi: {location.accuracy?.toFixed(0) ?? "-"}m | ⚡ Speed:{" "}
            {location.speed?.toFixed(1) ?? "0"} m/s
          </Text>
          <Text style={styles.debugText}>
            📏 Distance Interval: {distanceInterval}m (adaptif)
          </Text>
        </View>
      )}

      {/* ===== Section Laporan Terbaru ===== */}
      <Text style={styles.sectionTitle}>Laporan Terbaru</Text>
      {reportsWithDistance.map((report) => (
        <View key={report.id} style={styles.reportCard}>
          <View style={styles.reportIcon}>
            <Text style={styles.reportIconText}>⚠️</Text>
          </View>
          <View style={styles.reportInfo}>
            <Text style={styles.reportTitle}>{report.title}</Text>
            <Text style={styles.reportTime}>
              {formatRelativeTime(report.createdAt)}
            </Text>
          </View>
          <View style={styles.reportDistance}>
            <Text style={styles.reportDistanceText}>
              {report.distance !== null
                ? formatDistance(report.distance)
                : "..."}
            </Text>
          </View>
        </View>
      ))}

      {/* ===== Tombol Aksi ===== */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.primaryButton}
          activeOpacity={0.8}
          onPress={() => router.push("/report")}
        >
          <Text style={styles.buttonText}>BUAT LAPORAN</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} activeOpacity={0.8}>
          <Text style={styles.buttonText}>LIHAT LAPORAN</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a2332",
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 40,
  },

  // User Card
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#5ba4c9",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.3)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  userAvatarText: {
    fontSize: 22,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
  },
  trackingBadge: {
    fontSize: 11,
    color: "rgba(255,255,255,0.8)",
    marginTop: 2,
  },

  // Map
  mapContainer: {
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 16,
    height: 220,
    backgroundColor: "#2a3a4a",
  },
  map: {
    width: "100%",
    height: "100%",
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#aaa",
    marginTop: 10,
    fontSize: 14,
  },
  errorText: {
    color: "#e74c3c",
    fontSize: 14,
    textAlign: "center",
    paddingHorizontal: 20,
  },

  // Location Debug Info
  locationDebug: {
    backgroundColor: "rgba(91, 164, 201, 0.15)",
    borderRadius: 10,
    padding: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(91, 164, 201, 0.3)",
  },
  debugText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 11,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    lineHeight: 18,
  },

  // Section Title
  sectionTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
  },

  // Report Cards
  reportCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0f0f0",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  reportIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    borderWidth: 2,
    borderColor: "#e74c3c",
  },
  reportIconText: {
    fontSize: 18,
  },
  reportInfo: {
    flex: 1,
  },
  reportTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1a2332",
  },
  reportTime: {
    fontSize: 12,
    color: "#888",
    marginTop: 2,
  },
  reportDistance: {
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  reportDistanceText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#1a2332",
  },

  // Buttons
  buttonContainer: {
    marginTop: 24,
    gap: 12,
  },
  primaryButton: {
    backgroundColor: "#f0f0f0",
    borderRadius: 30,
    paddingVertical: 16,
    alignItems: "center",
  },
  secondaryButton: {
    backgroundColor: "#f0f0f0",
    borderRadius: 30,
    paddingVertical: 16,
    alignItems: "center",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1a2332",
    letterSpacing: 1,
  },
});
