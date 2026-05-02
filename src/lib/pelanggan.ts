import { eq } from "drizzle-orm";
import { db } from "@/db";
import { pelanggan } from "@/db/schema/pelanggan";
import { user as userTable } from "@/db/schema/auth";
import { generateUniqueKodeReferral, ensureKodeReferral } from "./loyalty";

/**
 * Cari atau buat record `pelanggan` untuk user yang login.
 * Dipanggil saat user pelanggan akses fitur order/riwayat — memastikan
 * setiap user punya satu row pelanggan yang link ke userId-nya.
 *
 * Auto-sync `pelanggan.telp` dari `user.phoneNumber` (untuk user yang regist
 * via WhatsApp OTP) kalau pelanggan.telp masih kosong.
 */
export async function getOrCreatePelanggan(userId: string, fallbackName: string) {
  const existing = await db.query.pelanggan.findFirst({
    where: eq(pelanggan.userId, userId),
  });

  if (existing) {
    const updates: Partial<typeof pelanggan.$inferInsert> = {};

    // Sync telp dari user.phoneNumber kalau pelanggan.telp masih kosong
    if (!existing.telp) {
      const u = await db.query.user.findFirst({ where: eq(userTable.id, userId) });
      if (u?.phoneNumber) updates.telp = u.phoneNumber;
    }

    // Pastikan kode referral ada
    if (!existing.kodeReferral) {
      const kode = await ensureKodeReferral(existing.id);
      // ensureKodeReferral sudah update DB; merge ke return value
      const merged = { ...existing, kodeReferral: kode, ...updates };
      if (Object.keys(updates).length > 0) {
        await db.update(pelanggan).set(updates).where(eq(pelanggan.id, existing.id));
      }
      return merged;
    }

    if (Object.keys(updates).length > 0) {
      await db.update(pelanggan).set(updates).where(eq(pelanggan.id, existing.id));
      return { ...existing, ...updates };
    }

    return existing;
  }

  // Buat record baru: ambil phoneNumber dari user kalau ada
  const u = await db.query.user.findFirst({ where: eq(userTable.id, userId) });
  const kodeReferral = await generateUniqueKodeReferral();
  const [created] = await db
    .insert(pelanggan)
    .values({
      userId,
      nama: fallbackName,
      telp: u?.phoneNumber ?? null,
      tipe: "umum",
      kodeReferral,
    })
    .returning();
  return created;
}
