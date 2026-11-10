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
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { router } from "expo-router";
import { useLocationTracking } from "@/hooks/useLocationTracking";

/**
 * Report Page - Halaman untuk membuat laporan kejadian baru.
 *
 * Fitur:
 * - Upload bukti kejadian (UI placeholder)
 * - Catat lokasi (menggunakan useLocationTracking)
 * - Input judul dan deskripsi
 * - Tombol kirim
 */
export default function ReportPage() {
  const { location, errorMsg, startTracking } = useLocationTracking();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [locationCaptured, setLocationCaptured] = useState(false);
  const [capturedCoords, setCapturedCoords] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  useEffect(() => {
    startTracking();
  }, [startTracking]);

  // Catat lokasi saat ini
  const handleCaptureLocation = () => {
    if (location) {
      setCapturedCoords({
        latitude: location.latitude,
        longitude: location.longitude,
      });
      setLocationCaptured(true);
      Alert.alert(
        "Lokasi Tercatat ✅",
        `Lat: ${location.latitude.toFixed(6)}\nLng: ${location.longitude.toFixed(6)}\nAkurasi: ${location.accuracy?.toFixed(0) ?? "-"}m`
      );
    } else {
      Alert.alert("Menunggu GPS", "Lokasi belum tersedia, tunggu beberapa saat.");
    }
  };

  // Kirim laporan
  const handleSubmit = () => {
    if (!title.trim()) {
      Alert.alert("Perhatian", "Mohon isi judul laporan.");
      return;
    }
    if (!description.trim()) {
      Alert.alert("Perhatian", "Mohon isi deskripsi laporan.");
      return;
    }
    if (!capturedCoords) {
      Alert.alert("Perhatian", "Mohon catat lokasi kejadian terlebih dahulu.");
      return;
    }
    Alert.alert("Laporan Terkirim ✅", `"${title}" berhasil dikirim!`, [
      { text: "OK", onPress: () => router.back() },
    ]);
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

      {/* ===== Upload Bukti Kejadian ===== */}
      <TouchableOpacity style={styles.uploadBox} activeOpacity={0.7}>
        <View style={styles.cameraIcon}>
          <Text style={styles.cameraEmoji}>📷</Text>
        </View>
        <Text style={styles.uploadText}>UPLOAD BUKTI KEJADIAN</Text>
        <Text style={styles.uploadHint}>Ketuk untuk memilih foto</Text>
      </TouchableOpacity>

      {/* ===== Catat Lokasi ===== */}
      <TouchableOpacity
        style={[
          styles.locationButton,
          locationCaptured && styles.locationButtonCaptured,
        ]}
        activeOpacity={0.8}
        onPress={handleCaptureLocation}
      >
        <Text style={styles.locationPin}>📍</Text>
        <Text style={styles.locationButtonText}>
          {locationCaptured ? "LOKASI TERCATAT ✅" : "CATAT LOKASI ANDA"}
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

      {/* Lokasi loading indicator */}
      {!location && !errorMsg && (
        <View style={styles.loadingLocation}>
          <ActivityIndicator size="small" color="#5ba4c9" />
          <Text style={styles.loadingLocationText}>Mencari lokasi GPS...</Text>
        </View>
      )}

      {errorMsg && (
        <View style={styles.errorBox}>
          <Text style={styles.errorBoxText}>⚠️ {errorMsg}</Text>
        </View>
      )}

      {/* ===== Input Judul ===== */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.titleInput}
          placeholder="JUDUL"
          placeholderTextColor="rgba(91, 164, 201, 0.6)"
          value={title}
          onChangeText={setTitle}
          maxLength={100}
        />
      </View>

      {/* ===== Input Deskripsi ===== */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.descriptionInput}
          placeholder="Deskripsi"
          placeholderTextColor="rgba(91, 164, 201, 0.6)"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={6}
          textAlignVertical="top"
          maxLength={1000}
        />
      </View>

      {/* ===== Tombol Kirim ===== */}
      <TouchableOpacity
        style={styles.submitButton}
        activeOpacity={0.8}
        onPress={handleSubmit}
      >
        <Text style={styles.submitButtonText}>KIRIM</Text>
      </TouchableOpacity>
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
    marginBottom: 20,
  },

  // Upload Box
  uploadBox: {
    backgroundColor: "rgba(91, 164, 201, 0.15)",
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "rgba(91, 164, 201, 0.4)",
    borderStyle: "dashed",
    paddingVertical: 40,
    alignItems: "center",
    marginBottom: 16,
  },
  cameraIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  cameraEmoji: {
    fontSize: 32,
  },
  uploadText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  uploadHint: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    marginTop: 4,
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
    fontSize: 14,
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

  // Loading Location
  loadingLocation: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 16,
  },
  loadingLocationText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
  },

  // Error
  errorBox: {
    backgroundColor: "rgba(231, 76, 60, 0.15)",
    borderRadius: 10,
    padding: 10,
    marginBottom: 16,
  },
  errorBoxText: {
    color: "#e74c3c",
    fontSize: 12,
    textAlign: "center",
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
    fontSize: 16,
  },
  descriptionInput: {
    backgroundColor: "rgba(91, 164, 201, 0.15)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(91, 164, 201, 0.3)",
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: "#fff",
    fontSize: 16,
    minHeight: 160,
  },

  // Submit Button
  submitButton: {
    backgroundColor: "#f0f0f0",
    borderRadius: 30,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 12,
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1a2332",
    letterSpacing: 2,
  },
});
