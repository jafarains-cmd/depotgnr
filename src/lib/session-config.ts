import { eq } from "drizzle-orm";
import { db } from "@/db";
import { pengaturan } from "@/db/schema/pengaturan";

/**
 * Baca idle timeout (menit) dari pengaturan. Default 240 (4 jam), 0 = nonaktif.
 * Berlaku untuk staff (admin/kasir/kurir) auto-logout saat idle.
 *
 * Default longgar karena depot butuh shift panjang tanpa gangguan.
 * Admin bisa turunkan kalau butuh security ketat (mis. komputer publik).
 */
export async function getIdleTimeoutMenit(): Promise<number> {
  const row = await db.query.pengaturan.findFirst({
    where: eq(pengaturan.key, "sessionTimeoutMenit"),
  });
  const n = Number(row?.value);
  if (!Number.isFinite(n) || n < 0) return 240;
  return n;
}
