import { eq } from "drizzle-orm";
import { db } from "@/db";
import { pengaturan } from "@/db/schema/pengaturan";

export const ZONA_OPTIONS = [
  { value: "Asia/Jakarta", label: "WIB — Asia/Jakarta (UTC+7)" },
  { value: "Asia/Makassar", label: "WITA — Asia/Makassar (UTC+8)" },
  { value: "Asia/Jayapura", label: "WIT — Asia/Jayapura (UTC+9)" },
];

export const DEFAULT_ZONA = "Asia/Jakarta";

/**
 * Server-side: baca zona waktu dari pengaturan. Fallback ke Asia/Jakarta.
 * Validasi di whitelist supaya tidak terima value sembarang.
 */
export async function getZonaWaktu(): Promise<string> {
  const row = await db.query.pengaturan.findFirst({
    where: eq(pengaturan.key, "zonaWaktu"),
  });
  const value = row?.value?.trim() ?? "";
  if (ZONA_OPTIONS.some((o) => o.value === value)) return value;
  return DEFAULT_ZONA;
}

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
