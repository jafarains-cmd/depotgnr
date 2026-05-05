// Pure shared utilities — safe to import dari client component.
// Untuk server-only `getZonaWaktu()` (akses db), import dari
// '@/lib/timezone-server'.

export const ZONA_OPTIONS = [
  { value: "Asia/Jakarta", label: "WIB — Asia/Jakarta (UTC+7)" },
  { value: "Asia/Makassar", label: "WITA — Asia/Makassar (UTC+8)" },
  { value: "Asia/Jayapura", label: "WIT — Asia/Jayapura (UTC+9)" },
];

export const DEFAULT_ZONA = "Asia/Jakarta";

/**
 * Format Date dengan zona waktu eksplisit. Pakai di client component yang
 * pernah hydration mismatch karena toLocaleString tanpa timeZone.
 */
export function formatTanggal(
  date: Date | string | number,
  options: Intl.DateTimeFormatOptions,
  tz: string = DEFAULT_ZONA,
): string {
  return new Date(date).toLocaleString("id-ID", { ...options, timeZone: tz });
}
