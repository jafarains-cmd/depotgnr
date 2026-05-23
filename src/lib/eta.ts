/**
 * Estimasi waktu tiba kurir berdasarkan jarak Haversine.
 * Asumsi kecepatan rata-rata motor di kota 25 km/jam (termasuk lampu merah).
 * Fallback ke jadwal yang sudah diset kalau kurir belum mulai antar.
 */

const DEFAULT_KECEPATAN_KMH = 25;
const MIN_ETA_MENIT = 3; // minimal tampilkan 3 menit (kurir mungkin di depan rumah)

export function jarakKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // km
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Hitung ETA dalam menit berdasarkan jarak kurir → tujuan.
 * Return null kalau salah satu titik tidak ada.
 */
export function etaMenit(
  kurir: { lat: number; lng: number } | null,
  tujuan: { lat: number; lng: number } | null,
  kecepatanKmh = DEFAULT_KECEPATAN_KMH,
): number | null {
  if (!kurir || !tujuan) return null;
  const jarak = jarakKm(kurir.lat, kurir.lng, tujuan.lat, tujuan.lng);
  const jam = jarak / kecepatanKmh;
  const menit = jam * 60;
  return Math.max(MIN_ETA_MENIT, Math.round(menit));
}

/**
 * Format menit jadi string ramah: "3 menit", "1 jam 15 menit", dll.
 */
export function formatEta(menit: number): string {
  if (menit < 60) return `${menit} menit`;
  const jam = Math.floor(menit / 60);
  const sisaMenit = menit % 60;
  if (sisaMenit === 0) return `${jam} jam`;
  return `${jam} jam ${sisaMenit} menit`;
}

/**
 * Format jadwal antar (Date) jadi string ringkas: "hari ini 14:30",
 * "besok 09:00", "Sab 25 Mei 14:00".
 */
export function formatJadwalAntar(jadwal: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date(today);
  dayAfter.setDate(dayAfter.getDate() + 2);

  const jadwalDate = new Date(
    jadwal.getFullYear(),
    jadwal.getMonth(),
    jadwal.getDate(),
  );
  const time = jadwal.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (jadwalDate.getTime() === today.getTime()) return `hari ini ${time}`;
  if (jadwalDate.getTime() === tomorrow.getTime()) return `besok ${time}`;
  if (jadwalDate < dayAfter)
    return jadwal.toLocaleDateString("id-ID", {
      weekday: "short",
      day: "2-digit",
      month: "short",
    }) + ` ${time}`;
  return jadwal.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
  }) + ` ${time}`;
}
