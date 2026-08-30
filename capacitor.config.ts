import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor config untuk Depot Air Minum GNR.
 *
 * Mode: WebView remote — APK adalah wrapper native yang buka
 * https://depot.genster.my.id di WebView dengan akses Capacitor plugins
 * (background location, camera, notif native).
 *
 * Keuntungan mode ini:
 * - Update code web → APK auto-pull versi terbaru (tidak perlu rebuild APK
 *   setiap kali update logic web).
 * - Rebuild APK cuma perlu kalau ubah Capacitor plugin/permission.
 *
 * webDir cuma placeholder — tidak dipakai karena server.url di-set.
 */
const config: CapacitorConfig = {
  appId: "com.genster.depotair",
  appName: "Depot Air Minum GNR",
  webDir: "public",

  // Load app dari server remote (bukan bundled HTML)
  server: {
    url: "https://depot.genster.my.id",
    cleartext: false, // HTTPS only
    androidScheme: "https",
    // allowNavigation memastikan link internal buka di WebView, bukan external browser
    allowNavigation: ["depot.genster.my.id", "*.genster.my.id"],
  },

  // Plugin defaults
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: "#0284c7",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0284c7",
    },
    Geolocation: {
      // Permission text yang muncul saat request izin
      permissions: {
        location: "Aplikasi butuh akses lokasi untuk tracking kurir saat mengantar galon ke pelanggan.",
      },
    },
  },

  // Android-specific
  android: {
    // Package name di Play Store (permanent, tidak bisa diubah!)
    // buildOptions untuk sign akan di-set via env di CI/CD
    allowMixedContent: false,
    captureInput: true,
    // ENABLE untuk debug — matikan sebelum publish ke Play Store production
    webContentsDebuggingEnabled: true,
    // Loading timeout longer untuk koneksi lambat
    loggingBehavior: "debug",
  },
};

export default config;
