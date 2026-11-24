import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
  ActivityIndicator,
  Modal,
} from "react-native";
import { Image } from "expo-image";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { router } from "expo-router";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import { useJustInTimePermissions } from "@/hooks/useJustInTimePermissions";
import {
  getUserCredentials,
  initDefaultCredentialsIfNeeded,
  maskNIK,
  UserCredentials,
} from "@/services/secureStorage";
import {
  saveMediaToSandbox,
  saveReportOffline,
  deleteMediaFromSandbox,
  formatBytes,
} from "@/services/sandboxStorage";

/**
 * Pertemuan 10: Milestone 2 — Offline-First Architecture & Secure Storage Integration
 *
 * Implementasi:
 * 1. Integrasi expo-secure-store: Mengambil data sensitif NIK & Token kredensial pelapor.
 * 2. Integrasi expo-file-system: Menyalin media foto ke Scoped Storage (documentDirectory) & simpan offline report.
 * 3. Just-In-Time Permissions: Izin Kamera, Galeri, dan Lokasi hanya diminta saat dibutuhkan disertai rationale.
 */
export default function ReportPage() {
  const { requestLocationJIT, requestCameraJIT, requestMediaLibraryJIT } =
    useJustInTimePermissions();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [userCreds, setUserCreds] = useState<UserCredentials | null>(null);

  // State media sandbox
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [mediaFilename, setMediaFilename] = useState<string | null>(null);
  const [mediaSize, setMediaSize] = useState<number>(0);
  const [isProcessingMedia, setIsProcessingMedia] = useState(false);
  const [showMediaPickerModal, setShowMediaPickerModal] = useState(false);

  // State lokasi
  const [isLocating, setIsLocating] = useState(false);
  const [capturedCoords, setCapturedCoords] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  // Muat kredensial pelapor dari hardware-backed SecureStore
  useEffect(() => {
    async function loadCreds() {
      const creds = await initDefaultCredentialsIfNeeded();
      setUserCreds(creds);
    }
    loadCreds();
  }, []);

  // Alur Just-In-Time untuk pengambilan foto via Kamera
  const handlePickFromCamera = async () => {
    setShowMediaPickerModal(false);
    const hasPermission = await requestCameraJIT(true);
    if (!hasPermission) return;

    try {
      setIsProcessingMedia(true);
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const picked = result.assets[0];
        // Simpan langsung ke sandbox documentDirectory
        const saved = await saveMediaToSandbox(picked.uri);
        setMediaUri(saved.uri);
        setMediaFilename(saved.filename);
        setMediaSize(saved.size);
        Alert.alert(
          "Media Tersimpan di Sandbox 📁",
          `Foto berhasil disalin ke Scoped Storage:\n${saved.filename} (${formatBytes(saved.size)})`
        );
      }
    } catch (error) {
      Alert.alert("Gagal Mengambil Foto", (error as Error).message);
    } finally {
      setIsProcessingMedia(false);
    }
  };

  // Alur Just-In-Time untuk pemilihan foto via Galeri
  const handlePickFromGallery = async () => {
    setShowMediaPickerModal(false);
    const hasPermission = await requestMediaLibraryJIT(true);
    if (!hasPermission) return;

    try {
      setIsProcessingMedia(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const picked = result.assets[0];
        // Simpan langsung ke sandbox documentDirectory
        const saved = await saveMediaToSandbox(picked.uri);
        setMediaUri(saved.uri);
        setMediaFilename(saved.filename);
        setMediaSize(saved.size);
        Alert.alert(
          "Media Tersimpan di Sandbox 📁",
          `Foto berhasil disalin ke Scoped Storage:\n${saved.filename} (${formatBytes(saved.size)})`
        );
      }
    } catch (error) {
      Alert.alert("Gagal Memilih Foto", (error as Error).message);
    } finally {
      setIsProcessingMedia(false);
    }
  };

  // Hapus foto dari sandbox
  const handleRemoveMedia = async () => {
    if (mediaUri) {
      await deleteMediaFromSandbox(mediaUri);
      setMediaUri(null);
      setMediaFilename(null);
      setMediaSize(0);
    }
  };

  // Alur Just-In-Time untuk pencatatan lokasi GPS
  const handleCaptureLocation = async () => {
    const hasPermission = await requestLocationJIT(true);
    if (!hasPermission) return;

    try {
      setIsLocating(true);
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      setCapturedCoords({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });

      Alert.alert(
        "Lokasi GPS Tercatat ✅",
        `Lat: ${pos.coords.latitude.toFixed(6)}\nLng: ${pos.coords.longitude.toFixed(6)}\nAkurasi: ${pos.coords.accuracy?.toFixed(0) ?? "-"}m`
      );
    } catch (error) {
      Alert.alert("Gagal Mendapatkan Lokasi", (error as Error).message);
    } finally {
      setIsLocating(false);
    }
  };

  // Kirim & Simpan Laporan secara Offline-First
  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert("Perhatian", "Mohon isi judul laporan kejadian.");
      return;
    }
    if (!description.trim()) {
      Alert.alert("Perhatian", "Mohon isi deskripsi kejadian.");
      return;
    }
    if (!capturedCoords) {
      Alert.alert("Perhatian", "Mohon catat lokasi kejadian terlebih dahulu.");
      return;
    }

    const currentCreds = userCreds ?? (await getUserCredentials());

    const newReport = {
      id: "offline_" + Date.now().toString(),
      title: title.trim(),
      description: description.trim(),
      latitude: capturedCoords.latitude,
      longitude: capturedCoords.longitude,
      createdAt: new Date().toISOString(),
      mediaUri: mediaUri ?? undefined,
      mediaFilename: mediaFilename ?? undefined,
      mediaSize: mediaSize > 0 ? mediaSize : undefined,
      authorNIKMasked: currentCreds ? maskNIK(currentCreds.nik) : undefined,
      isOffline: true,
    };

    // Simpan ke sandbox JSON file (Scoped Storage Offline-First)
    await saveReportOffline(newReport);

    Alert.alert(
      "Laporan Tersimpan Offline ✅",
      `"${title}" berhasil disimpan di Scoped Storage (documentDirectory).\nData pelapor terenkripsi hardware-backed SecureStore.`,
      [{ text: "Selesai", onPress: () => router.back() }]
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header dengan tombol kembali */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => router.back()}
        activeOpacity={0.7}
      >
        <Text style={styles.backButtonText}>← Kembali</Text>
      </TouchableOpacity>

      <Text style={styles.pageTitle}>Buat Laporan Baru</Text>

      {/* Deliverable 1: Identity Badge dari SecureStore */}
      {userCreds && (
        <View style={styles.secureBadgeContainer}>
          <Text style={styles.secureBadgeIcon}>🔐</Text>
          <View style={styles.secureBadgeTextWrap}>
            <Text style={styles.secureBadgeTitle}>Identitas Terenkripsi (SecureStore)</Text>
            <Text style={styles.secureBadgeSubtitle}>
              Pelapor: {userCreds.name} • NIK: {maskNIK(userCreds.nik)}
            </Text>
          </View>
        </View>
      )}

      {/* Deliverable 2 & 3: Upload Bukti Kejadian (Sandbox + JIT Permission) */}
      {mediaUri ? (
        <View style={styles.previewContainer}>
          <Image
            source={{ uri: mediaUri }}
            style={styles.previewImage}
            contentFit="cover"
          />
          <View style={styles.previewOverlay}>
            <View style={styles.sandboxTag}>
              <Text style={styles.sandboxTagText}>
                📁 Scoped Storage ({formatBytes(mediaSize)})
              </Text>
            </View>
            <View style={styles.previewActions}>
              <TouchableOpacity
                style={styles.previewActionBtn}
                onPress={() => setShowMediaPickerModal(true)}
              >
                <Text style={styles.previewActionText}>Ganti</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.previewActionBtn, styles.deleteActionBtn]}
                onPress={handleRemoveMedia}
              >
                <Text style={styles.previewActionText}>Hapus</Text>
              </TouchableOpacity>
            </View>
          </View>
          {mediaFilename && (
            <Text style={styles.filenameText} numberOfLines={1}>
              Sandbox File: {mediaFilename}
            </Text>
          )}
        </View>
      ) : (
        <TouchableOpacity
          style={styles.uploadBox}
          activeOpacity={0.7}
          onPress={() => setShowMediaPickerModal(true)}
        >
          {isProcessingMedia ? (
            <ActivityIndicator size="large" color="#5ba4c9" />
          ) : (
            <>
              <View style={styles.cameraIcon}>
                <Text style={styles.cameraEmoji}>📷</Text>
              </View>
              <Text style={styles.uploadText}>UPLOAD BUKTI KEJADIAN</Text>
              <Text style={styles.uploadHint}>
                Ketuk untuk memilih foto (Kamera / Galeri - JIT)
              </Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {/* Deliverable 3: Catat Lokasi Anda (JIT Permission Flow) */}
      <TouchableOpacity
        style={[
          styles.locationButton,
          capturedCoords && styles.locationButtonCaptured,
        ]}
        activeOpacity={0.8}
        onPress={handleCaptureLocation}
        disabled={isLocating}
      >
        <Text style={styles.locationPin}>📍</Text>
        <Text style={styles.locationButtonText}>
          {isLocating
            ? "MENGAMBIL KOORDINAT GPS..."
            : capturedCoords
            ? "LOKASI TERCATAT ✅"
            : "CATAT LOKASI ANDA (JIT GPS)"}
        </Text>
        <Text style={styles.locationPin}>📍</Text>
      </TouchableOpacity>

      {/* Mini map setelah lokasi tercatat */}
      {capturedCoords && (
        <View style={styles.miniMapContainer}>
          <MapView
            style={styles.miniMap}
            provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
            region={{
              latitude: capturedCoords.latitude,
              longitude: capturedCoords.longitude,
              latitudeDelta: 0.005,
              longitudeDelta: 0.005,
            }}
            scrollEnabled={false}
            zoomEnabled={false}
          >
            <Marker
              coordinate={capturedCoords}
              title="Lokasi Kejadian"
              pinColor="#e74c3c"
            />
          </MapView>
          <Text style={styles.coordsText}>
            {capturedCoords.latitude.toFixed(6)},{" "}
            {capturedCoords.longitude.toFixed(6)}
          </Text>
        </View>
      )}

      {/* Input Judul */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.titleInput}
          placeholder="JUDUL KEJADIAN"
          placeholderTextColor="rgba(91, 164, 201, 0.6)"
          value={title}
          onChangeText={setTitle}
          maxLength={100}
        />
      </View>

      {/* Input Deskripsi */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.descriptionInput}
          placeholder="Deskripsi kerusakan atau kejadian..."
          placeholderTextColor="rgba(91, 164, 201, 0.6)"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={5}
          textAlignVertical="top"
          maxLength={1000}
        />
      </View>

      {/* Tombol Simpan Laporan Offline */}
      <TouchableOpacity
        style={styles.submitButton}
        activeOpacity={0.8}
        onPress={handleSubmit}
      >
        <Text style={styles.submitButtonText}>SIMPAN LAPORAN OFFLINE</Text>
      </TouchableOpacity>

      {/* Modal Pemilihan Sumber Media (Just-In-Time) */}
      <Modal
        visible={showMediaPickerModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMediaPickerModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowMediaPickerModal(false)}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Pilih Sumber Bukti Foto</Text>
            <Text style={styles.modalSubtitle}>
              Izin hanya akan diminta saat aksi dipilih (Just-In-Time) dan foto
              akan disimpan di Scoped Storage (documentDirectory).
            </Text>

            <TouchableOpacity
              style={styles.modalOptionBtn}
              onPress={handlePickFromCamera}
            >
              <Text style={styles.modalOptionIcon}>📷</Text>
              <View style={styles.modalOptionTextWrap}>
                <Text style={styles.modalOptionTitle}>Ambil Foto dari Kamera</Text>
                <Text style={styles.modalOptionDesc}>
                  Buka kamera untuk memotret kejadian secara langsung
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalOptionBtn}
              onPress={handlePickFromGallery}
            >
              <Text style={styles.modalOptionIcon}>🖼️</Text>
              <View style={styles.modalOptionTextWrap}>
                <Text style={styles.modalOptionTitle}>Pilih dari Galeri</Text>
                <Text style={styles.modalOptionDesc}>
                  Pilih foto bukti yang sudah tersimpan di galeri perangkat
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setShowMediaPickerModal(false)}
            >
              <Text style={styles.modalCancelText}>Batal</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
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

  // Header
  backButton: {
    marginBottom: 8,
  },
  backButtonText: {
    color: "#5ba4c9",
    fontSize: 16,
    fontWeight: "600",
  },
  pageTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 16,
  },

  // Secure Badge
  secureBadgeContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(46, 204, 113, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(46, 204, 113, 0.3)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 12,
  },
  secureBadgeIcon: {
    fontSize: 22,
  },
  secureBadgeTextWrap: {
    flex: 1,
  },
  secureBadgeTitle: {
    color: "#2ecc71",
    fontSize: 12,
    fontWeight: "bold",
  },
  secureBadgeSubtitle: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 12,
    marginTop: 2,
  },

  // Upload Box
  uploadBox: {
    backgroundColor: "rgba(91, 164, 201, 0.15)",
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "rgba(91, 164, 201, 0.4)",
    borderStyle: "dashed",
    paddingVertical: 36,
    alignItems: "center",
    marginBottom: 16,
  },
  cameraIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  cameraEmoji: {
    fontSize: 30,
  },
  uploadText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  uploadHint: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    marginTop: 4,
  },

  // Media Preview
  previewContainer: {
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#16202c",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(91, 164, 201, 0.3)",
  },
  previewImage: {
    width: "100%",
    height: 200,
  },
  previewOverlay: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 10,
    backgroundColor: "rgba(26, 35, 50, 0.9)",
  },
  sandboxTag: {
    backgroundColor: "#2980b9",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  sandboxTagText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "bold",
  },
  previewActions: {
    flexDirection: "row",
    gap: 8,
  },
  previewActionBtn: {
    backgroundColor: "#5ba4c9",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  deleteActionBtn: {
    backgroundColor: "#e74c3c",
  },
  previewActionText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
  },
  filenameText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 11,
    paddingHorizontal: 10,
    paddingBottom: 8,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },

  // Location Button
  locationButton: {
    flexDirection: "row",
    backgroundColor: "#5ba4c9",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  locationButtonCaptured: {
    backgroundColor: "#2ecc71",
  },
  locationPin: {
    fontSize: 18,
  },
  locationButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "bold",
    letterSpacing: 1,
    flex: 1,
    textAlign: "center",
  },

  // Mini Map
  miniMapContainer: {
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 16,
    backgroundColor: "#2a3a4a",
  },
  miniMap: {
    width: "100%",
    height: 120,
  },
  coordsText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 11,
    textAlign: "center",
    paddingVertical: 6,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },

  // Inputs
  inputContainer: {
    marginBottom: 12,
  },
  titleInput: {
    backgroundColor: "rgba(91, 164, 201, 0.15)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(91, 164, 201, 0.3)",
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: "#fff",
    fontSize: 15,
  },
  descriptionInput: {
    backgroundColor: "rgba(91, 164, 201, 0.15)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(91, 164, 201, 0.3)",
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: "#fff",
    fontSize: 15,
    minHeight: 120,
  },

  // Submit Button
  submitButton: {
    backgroundColor: "#5ba4c9",
    borderRadius: 30,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 12,
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#fff",
    letterSpacing: 1.5,
  },

  // Modal JIT Picker
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#1f2c3f",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 6,
  },
  modalSubtitle: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 13,
    marginBottom: 20,
    lineHeight: 18,
  },
  modalOptionBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(91, 164, 201, 0.15)",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    gap: 14,
    borderWidth: 1,
    borderColor: "rgba(91, 164, 201, 0.25)",
  },
  modalOptionIcon: {
    fontSize: 28,
  },
  modalOptionTextWrap: {
    flex: 1,
  },
  modalOptionTitle: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "bold",
  },
  modalOptionDesc: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 12,
    marginTop: 2,
  },
  modalCancelBtn: {
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  modalCancelText: {
    color: "#e74c3c",
    fontSize: 15,
    fontWeight: "600",
  },
});
