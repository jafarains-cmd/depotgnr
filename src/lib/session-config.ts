import { eq } from "drizzle-orm";
import { db } from "@/db";
import { pengaturan } from "@/db/schema/pengaturan";

/**
 * Baca idle timeout (menit) dari pengaturan. Default 30, 0 = nonaktif.
 * Berlaku untuk staff (admin/kasir/kurir) auto-logout saat idle.
 */
export async function getIdleTimeoutMenit(): Promise<number> {
  const row = await db.query.pengaturan.findFirst({
    where: eq(pengaturan.key, "sessionTimeoutMenit"),
  });
  const n = Number(row?.value);
  if (!Number.isFinite(n) || n < 0) return 30;
  return n;
}
