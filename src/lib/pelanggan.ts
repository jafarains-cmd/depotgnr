import { eq } from "drizzle-orm";
import { db } from "@/db";
import { pelanggan } from "@/db/schema/pelanggan";

/**
 * Cari atau buat record `pelanggan` untuk user yang login.
 * Dipanggil saat user pelanggan akses fitur order/riwayat — memastikan
 * setiap user punya satu row pelanggan yang link ke userId-nya.
 */
export async function getOrCreatePelanggan(userId: string, fallbackName: string) {
  const existing = await db.query.pelanggan.findFirst({
    where: eq(pelanggan.userId, userId),
  });
  if (existing) return existing;

  const [created] = await db
    .insert(pelanggan)
    .values({ userId, nama: fallbackName, tipe: "umum" })
    .returning();
  return created;
}
