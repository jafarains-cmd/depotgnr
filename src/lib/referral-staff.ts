import { eq, and, sql } from "drizzle-orm";
import { db } from "@/db";
import { staffReferral, bonusReferralStaff } from "@/db/schema/referral-staff";
import { user as userTable } from "@/db/schema/auth";
import { pelanggan } from "@/db/schema/pelanggan";
import { pengaturan } from "@/db/schema/pengaturan";

const DEFAULT_BONUS_REFERRAL_STAFF = 5000;

/**
 * Generate kode referral 6 karakter untuk staff (kasir/admin/kurir).
 * Format: 3 huruf nama (uppercase) + 3 digit acak. Unique check.
 */
function generateKode(baseName: string): string {
  const huruf = baseName.replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 3).padEnd(3, "X");
  const angka = String(Math.floor(Math.random() * 1000)).padStart(3, "0");
  return huruf + angka;
}

/**
 * Pastikan staff punya kode referral. Idempoten — kalau sudah ada, return existing.
 * Hanya untuk role admin/kasir/kurir.
 */
export async function ensureKodeReferralStaff(userId: string): Promise<string> {
  const existing = await db.query.staffReferral.findFirst({
    where: eq(staffReferral.userId, userId),
  });
  if (existing) return existing.kode;

  const u = await db.query.user.findFirst({ where: eq(userTable.id, userId) });
  if (!u) throw new Error("User tidak ditemukan");
  if (u.role === "pelanggan") {
    throw new Error("Pelanggan punya kode referral sendiri di tabel pelanggan");
  }

  // Try generate unique kode, max 10 attempts
  for (let i = 0; i < 10; i++) {
    const kode = generateKode(u.name);
    const dup = await db.query.staffReferral.findFirst({
      where: eq(staffReferral.kode, kode),
    });
    if (!dup) {
      await db.insert(staffReferral).values({ userId, kode });
      return kode;
    }
  }
  throw new Error("Gagal generate kode referral unik setelah 10 percobaan");
}

/**
 * Cari userId staff berdasarkan kode referral. Untuk register page resolve param.
 */
export async function getUserIdByReferralKode(kode: string): Promise<string | null> {
  const row = await db.query.staffReferral.findFirst({
    where: eq(staffReferral.kode, kode.toUpperCase()),
  });
  return row?.userId ?? null;
}

/**
 * Ambil nominal bonus dari pengaturan.
 */
export async function getBonusReferralStaffAmount(): Promise<number> {
  const row = await db.query.pengaturan.findFirst({
    where: eq(pengaturan.key, "bonusReferralStaff"),
  });
  const n = Number(row?.value);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_BONUS_REFERRAL_STAFF;
  return Math.floor(n);
}

/**
 * Catat bonus referral staff saat pelanggan ORDER PERTAMA.
 * Idempoten via cek pelangganId (1 pelanggan = 1 bonus, no double).
 * Hanya jalan kalau:
 *  - pelanggan punya referredByUserId
 *  - bonus aktif (nominal > 0)
 *  - belum ada bonus record untuk pelanggan ini
 */
export async function claimStaffReferralBonusIfFirstOrder(
  pelangganId: number,
  refTransaksiId?: number,
): Promise<void> {
  const pel = await db.query.pelanggan.findFirst({
    where: eq(pelanggan.id, pelangganId),
  });
  if (!pel?.referredByUserId) return; // tidak ada staff yang ajak

  // Idempoten: cek apakah bonus sudah pernah dicatat untuk pelanggan ini
  const existing = await db.query.bonusReferralStaff.findFirst({
    where: eq(bonusReferralStaff.pelangganId, pelangganId),
  });
  if (existing) return;

  const nominal = await getBonusReferralStaffAmount();
  if (nominal <= 0) return;

  await db.insert(bonusReferralStaff).values({
    staffUserId: pel.referredByUserId,
    pelangganId,
    nominal,
    refTransaksiId: refTransaksiId ?? null,
    status: "pending",
  });
}

/**
 * Stats untuk dashboard kasir: berapa pelanggan aktif yang dia ajak.
 */
export async function getStatReferralStaff(userId: string): Promise<{
  totalAjak: number;
  totalAktif: number;
  bonusPending: number;
  bonusDibayar: number;
}> {
  const [pAjakRow] = await db
    .select({ n: sql<number>`count(*)` })
    .from(pelanggan)
    .where(eq(pelanggan.referredByUserId, userId));

  const bonusRows = await db
    .select({
      nominal: bonusReferralStaff.nominal,
      status: bonusReferralStaff.status,
    })
    .from(bonusReferralStaff)
    .where(eq(bonusReferralStaff.staffUserId, userId));

  let pending = 0;
  let dibayar = 0;
  for (const b of bonusRows) {
    if (b.status === "pending") pending += b.nominal;
    else dibayar += b.nominal;
  }

  return {
    totalAjak: Number(pAjakRow?.n ?? 0),
    totalAktif: bonusRows.length,
    bonusPending: pending,
    bonusDibayar: dibayar,
  };
}

/**
 * Bayar semua bonus pending milik staff. Mirror bayarBonusKurir pattern.
 * Owner panggil dari /admin/bonus-staff.
 */
export async function bayarBonusReferralStaff(args: {
  staffUserId: string;
  paidBy: string;
  catatan?: string;
}): Promise<{ count: number; total: number }> {
  const pendingRows = await db
    .select({ id: bonusReferralStaff.id, nominal: bonusReferralStaff.nominal })
    .from(bonusReferralStaff)
    .where(
      and(
        eq(bonusReferralStaff.staffUserId, args.staffUserId),
        eq(bonusReferralStaff.status, "pending"),
      ),
    );

  if (pendingRows.length === 0) return { count: 0, total: 0 };

  const total = pendingRows.reduce((s, r) => s + r.nominal, 0);

  await db
    .update(bonusReferralStaff)
    .set({
      status: "dibayar",
      paidAt: new Date(),
      paidBy: args.paidBy,
      catatan: args.catatan ?? null,
    })
    .where(
      and(
        eq(bonusReferralStaff.staffUserId, args.staffUserId),
        eq(bonusReferralStaff.status, "pending"),
      ),
    );

  return { count: pendingRows.length, total };
}
