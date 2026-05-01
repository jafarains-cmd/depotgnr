/**
 * Konstanta global yang dipakai lintas-fitur. Hindari magic numbers di kode.
 */

// Tracking kurir
export const TRACKING_PUSH_INTERVAL_MS = 30_000; // kurir push lokasi tiap 30 detik
export const TRACKING_REFRESH_MS = 15_000; // halaman publik /track refresh tiap 15 detik
export const TRACKING_TTL_DAYS = 30; // simpan riwayat lokasi 30 hari

// App URL untuk link absolute (notif WA dengan link tracking, dll)
// Production: depot.genster.my.id, dev: localhost.
// Pakai NEXT_PUBLIC_APP_URL di env, fallback BETTER_AUTH_URL, fallback localhost.
export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ??
  process.env.BETTER_AUTH_URL ??
  "http://localhost:3000";

// Loyalty
export const RATE_ANTAR_PER_GALON = 250;
export const RATE_DEPOT_PER_GALON = 500;
export const REFERRAL_BONUS = 5_000;

// Webhook
export const WEBHOOK_TIMEOUT_MS = 10_000;
