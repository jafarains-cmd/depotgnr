import { eq } from "drizzle-orm";
import { db } from "@/db";
import { pengaturan } from "@/db/schema/pengaturan";
import { ZONA_OPTIONS, DEFAULT_ZONA } from "./timezone";

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
