import { eq, sql, and } from "drizzle-orm";
import { db } from "@/db";
import { pelanggan, mutasiLoyalti } from "@/db/schema/pelanggan";
import { user as userTable } from "@/db/schema/auth";
import { generateUniqueKodeReferral, ensureKodeReferral, getLoyaltyConfig } from "./loyalty";

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

  // Welcome bonus: TIDAK lagi diberi saat registrasi. Dipindah ke first
  // order (lihat claimReferralBonusIfFirstOrder di lib/loyalty.ts) supaya
  // hanya pelanggan aktif yang dapat — cegah abuse akun fake.

  return created;
}

/**
 * Beri welcome bonus saat pelanggan order pertama. Idempoten — cek mutasi
 * loyalty existing supaya tidak dobel. Dipanggil dari
 * claimReferralBonusIfFirstOrder (lib/loyalty.ts).
 *
 * GUARD: hanya pelanggan yang punya akun (userId != null) yang dapat.
 * Walk-in murni (dibuat kasir tanpa akun) TIDAK dapat — kebijakan
 * owner: welcome bonus mendorong pelanggan registrasi via app/WA/email.
 */
export async function giveWelcomeBonus(pelangganId: number): Promise<void> {
  const cfg = await getLoyaltyConfig();
  if (cfg.welcomeBonus <= 0) return;

  // Hanya pelanggan yang punya akun (registrasi via app, WA, atau email)
  // yang berhak welcome bonus. Walk-in tanpa akun = skip.
  const pelData = await db.query.pelanggan.findFirst({
    where: eq(pelanggan.id, pelangganId),
  });
  if (!pelData?.userId) return;

  // Idempoten: cek apakah sudah pernah dapat welcome bonus
  const existing = await db.query.mutasiLoyalti.findFirst({
    where: and(
      eq(mutasiLoyalti.pelangganId, pelangganId),
      eq(mutasiLoyalti.tipe, "adjust"),
      sql`${mutasiLoyalti.deskripsi} LIKE '%Welcome bonus%'`,
    ),
  });
  if (existing) return;

  await db.insert(mutasiLoyalti).values({
    pelangganId,
    jumlah: cfg.welcomeBonus,
    tipe: "adjust",
    deskripsi: `Welcome bonus pendaftaran (+${cfg.welcomeBonus.toLocaleString("id-ID")})`,
  });
  await db
    .update(pelanggan)
    .set({ saldoLoyalti: sql`${pelanggan.saldoLoyalti} + ${cfg.welcomeBonus}` })
    .where(eq(pelanggan.id, pelangganId));
}
