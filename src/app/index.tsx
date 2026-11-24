import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Modal,
  Alert,
} from "react-native";
import { Image } from "expo-image";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { router, useFocusEffect } from "expo-router";
import { useLocationTracking } from "@/hooks/useLocationTracking";
import { useJustInTimePermissions } from "@/hooks/useJustInTimePermissions";
import { haversineDistance, formatDistance } from "@/utils/haversine";
import { DUMMY_REPORTS, formatRelativeTime } from "@/data/reports";
import {
  initDefaultCredentialsIfNeeded,
  maskNIK,
  maskToken,
  UserCredentials,
  isSecureStoreSupported,
} from "@/services/secureStorage";
import {
  getOfflineReports,
  getSandboxStats,
  deleteMediaFromSandbox,
  formatBytes,
  LocalReport,
  SandboxStats,
} from "@/services/sandboxStorage";

/**
 * Landing Page - Halaman utama aplikasi pelaporan kerusakan kota.
 *
 * Pertemuan 10: Milestone 2 — Offline-First Architecture & Secure Storage Integration
 * 1. Integrasi expo-secure-store untuk enkripsi data sensitif (Token/NIK/Kredensial) ✓
 * 2. Integrasi expo-file-system (documentDirectory) untuk penanganan dokumen/media sandbox ✓
 * 3. Penanganan Runtime Permissions (Kamera/Lokasi/Storage) berbasis alur Just-In-Time ✓
 */
export default function LandingPage() {
  const { location, errorMsg, isTracking, distanceInterval, startTracking } =
    useLocationTracking();
  const { requestLocationJIT } = useJustInTimePermissions();

  const [userCreds, setUserCreds] = useState<UserCredentials | null>(null);
  const [offlineReports, setOfflineReports] = useState<LocalReport[]>([]);
  const [sandboxStats, setSandboxStats] = useState<SandboxStats | null>(null);
  const [isHardwareBacked, setIsHardwareBacked] = useState(false);

  // Modal State
  const [showSecureModal, setShowSecureModal] = useState(false);
  const [showFullNIK, setShowFullNIK] = useState(false);
  const [showFullToken, setShowFullToken] = useState(false);

  // Muat kredensial aman & statistik saat mount
  useEffect(() => {
    async function loadSecurityInfo() {
      const creds = await initDefaultCredentialsIfNeeded();
      setUserCreds(creds);
      const supported = await isSecureStoreSupported();
      setIsHardwareBacked(supported);
    }
    loadSecurityInfo();
  }, []);

  // Refresh laporan offline & sandbox stats setiap kali halaman mendapatkan fokus
  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      async function refreshOfflineData() {
        const reports = await getOfflineReports();
        const stats = await getSandboxStats();
        if (isMounted) {
          setOfflineReports(reports);
          setSandboxStats(stats);
        }
      }
      refreshOfflineData();
      return () => {
        isMounted = false;
      };
    }, [])
  );

  // Inisialisasi tracking lokasi secara cerdas / JIT
  const handleEnableLocationJIT = async () => {
    const granted = await requestLocationJIT(true);
    if (granted) {
      await startTracking();
    }
  };

  // Otomatis tracking jika izin sudah pernah diberikan sebelumnya
  useEffect(() => {
    startTracking();
  }, [startTracking]);

  // Hapus laporan offline tertentu
  const handleDeleteOfflineReport = async (report: LocalReport) => {
    Alert.alert(
      "Hapus Laporan Offline",
      `Hapus "${report.title}" beserta media dari sandbox?`,
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Hapus",
          style: "destructive",
          onPress: async () => {
            if (report.mediaUri) {
              await deleteMediaFromSandbox(report.mediaUri);
            }
            const updated = await getOfflineReports();
            const filtered = updated.filter((r) => r.id !== report.id);
            // Simpan ulang ke sandbox
            const FileSystem = await import("expo-file-system/legacy");
            if (FileSystem.documentDirectory) {
              await FileSystem.writeAsStringAsync(
                `${FileSystem.documentDirectory}cfd_sandbox/offline_reports.json`,
                JSON.stringify(filtered, null, 2),
                { encoding: FileSystem.EncodingType.UTF8 }
              );
            }
            setOfflineReports(filtered);
            const stats = await getSandboxStats();
            setSandboxStats(stats);
          },
        },
      ]
    );
  };

  // Gabungkan laporan bawaan dan laporan offline dari Scoped Storage
  const allReports = [
    ...offlineReports.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      latitude: r.latitude,
      longitude: r.longitude,
      createdAt: new Date(r.createdAt),
      imageUri: r.mediaUri,
      isOffline: true,
      authorNIKMasked: r.authorNIKMasked,
      mediaFilename: r.mediaFilename,
      mediaSize: r.mediaSize,
    })),
    ...DUMMY_REPORTS.map((r) => ({
      ...r,
      isOffline: false,
      authorNIKMasked: undefined,
      mediaFilename: undefined,
      mediaSize: undefined,
    })),
  ];

  // Hitung jarak dari user ke setiap laporan menggunakan Haversine
  const reportsWithDistance = allReports.map((report) => {
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
      {/* ===== Deliverable 1: Informasi User & Status SecureStore ===== */}
      <TouchableOpacity
        style={styles.userCard}
        activeOpacity={0.85}
        onPress={() => setShowSecureModal(true)}
      >
        <View style={styles.userAvatar}>
          <Text style={styles.userAvatarText}>👤</Text>
        </View>
        <View style={styles.userInfo}>
          <View style={styles.userNameRow}>
            <Text style={styles.userName}>
              {userCreds ? userCreds.name : "Iwan Kusnandar"}
            </Text>
            <View style={styles.secureBadgePill}>
              <Text style={styles.secureBadgePillText}>
                {isHardwareBacked ? "🔒 Keystore" : "🔐 SecureStore"}
              </Text>
            </View>
          </View>
          <Text style={styles.userNikText}>
            NIK: {userCreds ? maskNIK(userCreds.nik) : "317101******0001"}
          </Text>
          {isTracking ? (
            <Text style={styles.trackingBadge}>
              📍 GPS Aktif • Interval: {distanceInterval}m
            </Text>
          ) : (
            <Text style={styles.trackingInactiveBadge}>
              ⚠️ GPS belum aktif (Ketuk untuk izin JIT)
            </Text>
          )}
        </View>
      </TouchableOpacity>

      {/* Banner JIT jika lokasi belum aktif */}
      {!location && !isTracking && (
        <TouchableOpacity
          style={styles.jitLocationBanner}
          activeOpacity={0.8}
          onPress={handleEnableLocationJIT}
        >
          <Text style={styles.jitBannerIcon}>📍</Text>
          <View style={styles.jitBannerTextWrap}>
            <Text style={styles.jitBannerTitle}>Aktifkan Lokasi (Just-In-Time)</Text>
            <Text style={styles.jitBannerDesc}>
              Ketuk untuk memberikan izin lokasi dan menampilkan peta real-time
            </Text>
          </View>
        </TouchableOpacity>
      )}

      {/* ===== Peta Lokasi User (react-native-maps) ===== */}
      <View style={styles.mapContainer}>
        {location ? (
          <MapView
            style={styles.map}
            provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
            initialRegion={{
              latitude: location.latitude,
              longitude: location.longitude,
              latitudeDelta: 0.015,
              longitudeDelta: 0.015,
            }}
            region={{
              latitude: location.latitude,
              longitude: location.longitude,
              latitudeDelta: 0.015,
              longitudeDelta: 0.015,
            }}
            showsUserLocation
            showsMyLocationButton
          >
            {/* Custom Markers untuk semua laporan (bawaan & offline sandbox) */}
            {allReports.map((report) => (
              <Marker
                key={report.id}
                coordinate={{
                  latitude: report.latitude,
                  longitude: report.longitude,
                }}
                title={report.title}
                description={
                  report.isOffline
                    ? `[Offline Sandbox] ${report.description}`
                    : report.description
                }
                pinColor={report.isOffline ? "#2ecc71" : "#e74c3c"}
              />
            ))}
          </MapView>
        ) : (
          <View style={styles.mapPlaceholder}>
            {errorMsg ? (
              <TouchableOpacity
                onPress={handleEnableLocationJIT}
                style={styles.errorContainer}
              >
                <Text style={styles.errorText}>⚠️ {errorMsg}</Text>
                <Text style={styles.retryText}>Ketuk untuk Izinkan Lokasi</Text>
              </TouchableOpacity>
            ) : (
              <>
                <ActivityIndicator size="large" color="#5ba4c9" />
                <Text style={styles.loadingText}>Memuat peta & lokasi...</Text>
              </>
            )}
          </View>
        )}
      </View>

      {/* ===== Informasi Tracking (Debug & Info) ===== */}
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

      {/* ===== Deliverable 2: Status Scoped Storage Sandbox Bar ===== */}
      {sandboxStats && (
        <TouchableOpacity
          style={styles.sandboxStatusBar}
          activeOpacity={0.8}
          onPress={() => setShowSecureModal(true)}
        >
          <Text style={styles.sandboxStatusIcon}>📁</Text>
          <View style={styles.sandboxStatusTextWrap}>
            <Text style={styles.sandboxStatusTitle}>
              Scoped Storage Sandbox (documentDirectory)
            </Text>
            <Text style={styles.sandboxStatusDesc}>
              {sandboxStats.mediaCount} file media tersimpan •{" "}
              {formatBytes(sandboxStats.totalSizeBytes)} terpakai •{" "}
              {offlineReports.length} laporan offline
            </Text>
          </View>
          <Text style={styles.sandboxStatusArrow}>›</Text>
        </TouchableOpacity>
      )}

      {/* ===== Section Laporan Terbaru (Gabungan Bawaan + Offline Sandbox) ===== */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Laporan Terbaru</Text>
        <Text style={styles.sectionBadge}>
          {allReports.length} Laporan ({offlineReports.length} Offline)
        </Text>
      </View>

      {reportsWithDistance.map((report) => (
        <View key={report.id} style={styles.reportCard}>
          {report.imageUri ? (
            <Image
              source={{ uri: report.imageUri }}
              style={styles.reportThumbnail}
              contentFit="cover"
            />
          ) : (
            <View
              style={[
                styles.reportIcon,
                report.isOffline && styles.reportIconOffline,
              ]}
            >
              <Text style={styles.reportIconText}>
                {report.isOffline ? "📁" : "⚠️"}
              </Text>
            </View>
          )}

          <View style={styles.reportInfo}>
            <View style={styles.reportHeaderRow}>
              <Text style={styles.reportTitle} numberOfLines={1}>
                {report.title}
              </Text>
              {report.isOffline && (
                <View style={styles.offlineBadge}>
                  <Text style={styles.offlineBadgeText}>OFFLINE</Text>
                </View>
              )}
            </View>

            <Text style={styles.reportTime}>
              {formatRelativeTime(report.createdAt)}
              {report.authorNIKMasked
                ? ` • NIK: ${report.authorNIKMasked}`
                : ""}
            </Text>

            {report.mediaFilename && (
              <Text style={styles.mediaFilenameTag} numberOfLines={1}>
                Sandbox: {report.mediaFilename}
              </Text>
            )}
          </View>

          <View style={styles.reportRightCol}>
            <View style={styles.reportDistance}>
              <Text style={styles.reportDistanceText}>
                {report.distance !== null
                  ? formatDistance(report.distance)
                  : "..."}
              </Text>
            </View>

            {report.isOffline && (
              <TouchableOpacity
                style={styles.deleteOfflineBtn}
                onPress={() => handleDeleteOfflineReport(report as unknown as LocalReport)}
              >
                <Text style={styles.deleteOfflineBtnText}>Hapus</Text>
              </TouchableOpacity>
            )}
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

        <TouchableOpacity
          style={styles.secondaryButton}
          activeOpacity={0.8}
          onPress={() => setShowSecureModal(true)}
        >
          <Text style={styles.buttonText}>LIHAT DETAIL KEAMANAN & STORAGE</Text>
        </TouchableOpacity>
      </View>

      {/* ===== Modal Secure Storage & Scoped Storage Manager ===== */}
      <Modal
        visible={showSecureModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSecureModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                🔐 Milestone 2: Security & Storage
              </Text>
              <TouchableOpacity
                onPress={() => setShowSecureModal(false)}
                style={styles.modalCloseBtn}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Deliverable 1: SecureStore Inspector */}
              <Text style={styles.modalSectionTitle}>
                1. Hardware-Backed SecureStore (expo-secure-store)
              </Text>
              <View style={styles.infoCard}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Status Keystore/Keychain:</Text>
                  <Text style={styles.infoValueSuccess}>
                    {isHardwareBacked ? "✅ Hardware-Backed Aktif" : "✅ Enkripsi Siap"}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Nama Pengguna:</Text>
                  <Text style={styles.infoValue}>
                    {userCreds?.name ?? "Iwan Kusnandar"}
                  </Text>
                </View>

                {/* NIK with Show/Hide toggle */}
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>NIK (Terkunci Keystore):</Text>
                  <View style={styles.valueWithToggle}>
                    <Text style={styles.infoValueHighlight}>
                      {showFullNIK
                        ? userCreds?.nik ?? "-"
                        : maskNIK(userCreds?.nik ?? "")}
                    </Text>
                    <TouchableOpacity
                      onPress={() => setShowFullNIK(!showFullNIK)}
                      style={styles.toggleBtn}
                    >
                      <Text style={styles.toggleBtnText}>
                        {showFullNIK ? "Sembunyikan" : "Tampilkan"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Token with Show/Hide toggle */}
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Session JWT Token:</Text>
                  <View style={styles.valueWithToggle}>
                    <Text style={styles.infoValueToken} numberOfLines={1}>
                      {showFullToken
                        ? userCreds?.token ?? "-"
                        : maskToken(userCreds?.token ?? "")}
                    </Text>
                    <TouchableOpacity
                      onPress={() => setShowFullToken(!showFullToken)}
                      style={styles.toggleBtn}
                    >
                      <Text style={styles.toggleBtnText}>
                        {showFullToken ? "Sembunyikan" : "Tampilkan"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* Deliverable 2: Scoped Storage Inspector */}
              <Text style={styles.modalSectionTitle}>
                2. Scoped Storage Sandbox (expo-file-system)
              </Text>
              <View style={styles.infoCard}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Root Direktori Sandbox:</Text>
                  <Text style={styles.infoValueMono} numberOfLines={2}>
                    FileSystem.documentDirectory
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Jumlah Berkas Media:</Text>
                  <Text style={styles.infoValue}>
                    {sandboxStats?.mediaCount ?? 0} file media
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Total Penggunaan Storage:</Text>
                  <Text style={styles.infoValue}>
                    {formatBytes(sandboxStats?.totalSizeBytes ?? 0)}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Laporan Tersimpan Offline:</Text>
                  <Text style={styles.infoValueHighlight}>
                    {offlineReports.length} laporan
                  </Text>
                </View>
              </View>

              {/* Deliverable 3: Just-In-Time Permissions Summary */}
              <Text style={styles.modalSectionTitle}>
                3. Alur Izin Runtime Just-In-Time (JIT)
              </Text>
              <View style={styles.infoCard}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>📍 Izin Lokasi:</Text>
                  <Text style={styles.infoValue}>
                    {isTracking ? "✅ Granted (Aktif)" : "⏳ Diminta Saat Aksi"}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>📷 Izin Kamera:</Text>
                  <Text style={styles.infoValue}>
                    ⏳ Diminta Saat Ambil Foto
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>🖼️ Izin Media Storage:</Text>
                  <Text style={styles.infoValue}>
                    ⏳ Diminta Saat Buka Galeri
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.modalPrimaryBtn}
                onPress={() => setShowSecureModal(false)}
              >
                <Text style={styles.modalPrimaryBtnText}>Tutup</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
    marginBottom: 14,
  },
  userAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
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
  userNameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  userName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
  },
  secureBadgePill: {
    backgroundColor: "rgba(26, 35, 50, 0.4)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  secureBadgePillText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "bold",
  },
  userNikText: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 12,
    marginTop: 2,
    fontWeight: "500",
  },
  trackingBadge: {
    fontSize: 11,
    color: "#fff",
    marginTop: 4,
  },
  trackingInactiveBadge: {
    fontSize: 11,
    color: "rgba(255, 230, 150, 1)",
    marginTop: 4,
  },

  // JIT Banner
  jitLocationBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(243, 156, 18, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(243, 156, 18, 0.4)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    gap: 10,
  },
  jitBannerIcon: {
    fontSize: 20,
  },
  jitBannerTextWrap: {
    flex: 1,
  },
  jitBannerTitle: {
    color: "#f39c12",
    fontSize: 13,
    fontWeight: "bold",
  },
  jitBannerDesc: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 11,
    marginTop: 2,
  },

  // Map
  mapContainer: {
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 14,
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
  errorContainer: {
    alignItems: "center",
    paddingHorizontal: 20,
  },
  errorText: {
    color: "#e74c3c",
    fontSize: 13,
    textAlign: "center",
  },
  retryText: {
    color: "#5ba4c9",
    fontSize: 13,
    fontWeight: "bold",
    marginTop: 6,
    textDecorationLine: "underline",
  },

  // Location Debug Info
  locationDebug: {
    backgroundColor: "rgba(91, 164, 201, 0.15)",
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(91, 164, 201, 0.3)",
  },
  debugText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 11,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    lineHeight: 18,
  },

  // Sandbox Status Bar
  sandboxStatusBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(41, 128, 185, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(41, 128, 185, 0.4)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 18,
    gap: 10,
  },
  sandboxStatusIcon: {
    fontSize: 22,
  },
  sandboxStatusTextWrap: {
    flex: 1,
  },
  sandboxStatusTitle: {
    color: "#5ba4c9",
    fontSize: 12,
    fontWeight: "bold",
  },
  sandboxStatusDesc: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 11,
    marginTop: 2,
  },
  sandboxStatusArrow: {
    color: "#5ba4c9",
    fontSize: 20,
    fontWeight: "bold",
  },

  // Section Header
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  sectionBadge: {
    color: "#5ba4c9",
    fontSize: 12,
    fontWeight: "600",
  },

  // Report Cards
  reportCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0f0f0",
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  reportThumbnail: {
    width: 48,
    height: 48,
    borderRadius: 10,
    marginRight: 12,
  },
  reportIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    borderWidth: 2,
    borderColor: "#e74c3c",
  },
  reportIconOffline: {
    borderColor: "#2ecc71",
  },
  reportIconText: {
    fontSize: 20,
  },
  reportInfo: {
    flex: 1,
  },
  reportHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  reportTitle: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#1a2332",
    flex: 1,
  },
  offlineBadge: {
    backgroundColor: "#2ecc71",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  offlineBadgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "bold",
  },
  reportTime: {
    fontSize: 11,
    color: "#666",
    marginTop: 2,
  },
  mediaFilenameTag: {
    fontSize: 10,
    color: "#2980b9",
    marginTop: 2,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  reportRightCol: {
    alignItems: "flex-end",
    gap: 6,
    marginLeft: 8,
  },
  reportDistance: {
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  reportDistanceText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#1a2332",
  },
  deleteOfflineBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  deleteOfflineBtnText: {
    color: "#e74c3c",
    fontSize: 10,
    fontWeight: "bold",
  },

  // Buttons
  buttonContainer: {
    marginTop: 20,
    gap: 12,
  },
  primaryButton: {
    backgroundColor: "#5ba4c9",
    borderRadius: 30,
    paddingVertical: 16,
    alignItems: "center",
  },
  secondaryButton: {
    backgroundColor: "rgba(91, 164, 201, 0.2)",
    borderWidth: 1,
    borderColor: "#5ba4c9",
    borderRadius: 30,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonText: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#fff",
    letterSpacing: 1,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#1a2332",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 22,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "bold",
  },
  modalCloseBtn: {
    padding: 6,
  },
  modalCloseText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  modalSectionTitle: {
    color: "#5ba4c9",
    fontSize: 13,
    fontWeight: "bold",
    marginTop: 12,
    marginBottom: 8,
  },
  infoCard: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    marginBottom: 10,
  },
  infoRow: {
    marginBottom: 8,
  },
  infoLabel: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 11,
    marginBottom: 2,
  },
  infoValue: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "500",
  },
  infoValueSuccess: {
    color: "#2ecc71",
    fontSize: 13,
    fontWeight: "bold",
  },
  infoValueHighlight: {
    color: "#f39c12",
    fontSize: 13,
    fontWeight: "bold",
  },
  infoValueToken: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 11,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    flex: 1,
  },
  infoValueMono: {
    color: "#5ba4c9",
    fontSize: 11,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  valueWithToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
  },
  toggleBtn: {
    backgroundColor: "rgba(91, 164, 201, 0.3)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  toggleBtnText: {
    color: "#5ba4c9",
    fontSize: 10,
    fontWeight: "bold",
  },
  modalPrimaryBtn: {
    backgroundColor: "#5ba4c9",
    borderRadius: 20,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 16,
    marginBottom: 10,
  },
  modalPrimaryBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
  },
});
