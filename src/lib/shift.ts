import { eq, and, sql, gte, lte, desc } from "drizzle-orm";
import { db } from "@/db";
import { shiftKasir } from "@/db/schema/shift";
import { transaksi } from "@/db/schema/transaksi";
import { orderHeader } from "@/db/schema/order";
import { pengeluaran } from "@/db/schema/pengeluaran";
import { user as userTable } from "@/db/schema/auth";

const REOPEN_WINDOW_MS = 30 * 60 * 1000; // 30 menit

/**
 * Ambil shift open milik user. Null kalau tidak ada.
 */
export async function getShiftAktif(userId: string) {
  return await db.query.shiftKasir.findFirst({
    where: and(eq(shiftKasir.kasirUserId, userId), eq(shiftKasir.status, "open")),
    orderBy: desc(shiftKasir.openedAt),
  });
}

/**
 * Ambil semua shift open di sistem (untuk take-over). Include nama kasir.
 */
export async function getSemuaShiftAktif() {
  return await db
    .select({
      id: shiftKasir.id,
      kasirUserId: shiftKasir.kasirUserId,
      kasirNama: userTable.name,
      openedAt: shiftKasir.openedAt,
      openingCash: shiftKasir.openingCash,
    })
    .from(shiftKasir)
    .leftJoin(userTable, eq(shiftKasir.kasirUserId, userTable.id))
    .where(eq(shiftKasir.status, "open"))
    .orderBy(desc(shiftKasir.openedAt));
}

/**
 * Hitung total omzet cash + pengeluaran cash + computed expected cash
 * untuk shift. Dipakai saat tutup shift untuk perbandingan vs uang fisik.
 */
export async function ringkasanShift(shiftId: number) {
  // Omzet transaksi POS cash dari shift ini
  const [trxRow] = await db
    .select({
      omzetCash: sql<number>`coalesce(sum(case when ${transaksi.metodeBayar} = 'cash' and ${transaksi.voidedAt} is null then ${transaksi.total} else 0 end), 0)`,
      omzetTransfer: sql<number>`coalesce(sum(case when ${transaksi.metodeBayar} = 'transfer' and ${transaksi.voidedAt} is null then ${transaksi.total} else 0 end), 0)`,
      omzetQris: sql<number>`coalesce(sum(case when ${transaksi.metodeBayar} = 'qris' and ${transaksi.voidedAt} is null then ${transaksi.total} else 0 end), 0)`,
      jumlahTransaksi: sql<number>`coalesce(sum(case when ${transaksi.voidedAt} is null then 1 else 0 end), 0)`,
    })
    .from(transaksi)
    .where(eq(transaksi.shiftId, shiftId));

  // Order lunas selama shift (statusBayar=lunas, bayarAt during shift)
  const [orderRow] = await db
    .select({
      omzetOrder: sql<number>`coalesce(sum(case when ${orderHeader.statusBayar} = 'lunas' then ${orderHeader.totalEstimasi} else 0 end), 0)`,
      jumlahOrder: sql<number>`coalesce(sum(case when ${orderHeader.statusBayar} = 'lunas' then 1 else 0 end), 0)`,
    })
    .from(orderHeader)
    .where(eq(orderHeader.shiftId, shiftId));

  // Pengeluaran selama shift
  const [pengRow] = await db
    .select({
      totalPengeluaran: sql<number>`coalesce(sum(${pengeluaran.jumlah}), 0)`,
      jumlahPengeluaran: sql<number>`coalesce(count(*), 0)`,
    })
    .from(pengeluaran)
    .where(eq(pengeluaran.shiftId, shiftId));

  const shift = await db.query.shiftKasir.findFirst({ where: eq(shiftKasir.id, shiftId) });
  const opening = shift?.openingCash ?? 0;
  const omzetCash = Number(trxRow?.omzetCash ?? 0);
  const totalPengeluaran = Number(pengRow?.totalPengeluaran ?? 0);
  const expected = opening + omzetCash - totalPengeluaran;

  return {
    openingCash: opening,
    omzetCash,
    omzetTransfer: Number(trxRow?.omzetTransfer ?? 0),
    omzetQris: Number(trxRow?.omzetQris ?? 0),
    omzetOrder: Number(orderRow?.omzetOrder ?? 0),
    jumlahTransaksi: Number(trxRow?.jumlahTransaksi ?? 0),
    jumlahOrder: Number(orderRow?.jumlahOrder ?? 0),
    totalPengeluaran,
    jumlahPengeluaran: Number(pengRow?.jumlahPengeluaran ?? 0),
    expected,
  };
}

/**
 * Buka shift baru untuk user. Gagal kalau sudah ada shift open milik user.
 */
export async function bukaShift(args: {
  kasirUserId: string;
  openingCash?: number | null;
}): Promise<{ ok: true; shiftId: number } | { error: string }> {
  const existing = await getShiftAktif(args.kasirUserId);
  if (existing) return { error: "Anda sudah punya shift open. Tutup dulu sebelum buka shift baru." };

  const [created] = await db
    .insert(shiftKasir)
    .values({
      kasirUserId: args.kasirUserId,
      openingCash: args.openingCash ?? null,
      status: "open",
    })
    .returning();
  return { ok: true, shiftId: created.id };
}

/**
 * Tutup shift. Input uang fisik yang dihitung kasir. Sistem hitung selisih.
 * Bisa di-tutup oleh: pemilik shift, admin, atau kasir lain (untuk emergency).
 */
export async function tutupShift(args: {
  shiftId: number;
  closingCashCounted: number;
  catatan?: string;
  buktiFotoUrl?: string | null;
  closedByUserId: string;
}): Promise<
  | { ok: true; selisih: number; expected: number }
  | { error: string }
> {
  const shift = await db.query.shiftKasir.findFirst({
    where: eq(shiftKasir.id, args.shiftId),
  });
  if (!shift) return { error: "Shift tidak ditemukan" };
  if (shift.status === "closed") return { error: "Shift sudah ditutup" };

  const summary = await ringkasanShift(args.shiftId);
  const selisih = args.closingCashCounted - summary.expected;

  await db
    .update(shiftKasir)
    .set({
      status: "closed",
      closingCashCounted: args.closingCashCounted,
      closingCashExpected: summary.expected,
      selisih,
      catatan: args.catatan?.trim() || null,
      buktiFotoUrl: args.buktiFotoUrl ?? null,
      closedAt: new Date(),
      closedByUserId: args.closedByUserId,
    })
    .where(eq(shiftKasir.id, args.shiftId));

  return { ok: true, selisih, expected: summary.expected };
}

/**
 * Re-open shift yang baru ditutup. Hanya jika ditutup < REOPEN_WINDOW_MS.
 */
export async function reopenShift(args: {
  shiftId: number;
  reopenedByUserId: string;
}): Promise<{ ok: true } | { error: string }> {
  const shift = await db.query.shiftKasir.findFirst({
    where: eq(shiftKasir.id, args.shiftId),
  });
  if (!shift) return { error: "Shift tidak ditemukan" };
  if (shift.status === "open") return { error: "Shift masih open" };
  if (!shift.closedAt) return { error: "Shift tidak punya closed_at" };

  const elapsed = Date.now() - shift.closedAt.getTime();
  if (elapsed > REOPEN_WINDOW_MS) {
    return {
      error: `Lewat batas waktu reopen (${Math.round(REOPEN_WINDOW_MS / 60000)} menit). Buka shift baru saja.`,
    };
  }

  await db
    .update(shiftKasir)
    .set({
      status: "open",
      closedAt: null,
      closingCashCounted: null,
      closingCashExpected: null,
      selisih: null,
      reopenedAt: new Date(),
      reopenedByUserId: args.reopenedByUserId,
    })
    .where(eq(shiftKasir.id, args.shiftId));

  return { ok: true };
}

/**
 * Resolve shiftId untuk transaksi/order/pengeluaran baru. Cari shift open
 * milik user. Kalau tidak ada → return null (caller decides: block atau auto-create).
 *
 * Kalau preferShiftId diberi (mis. dari take-over context), validasi shift
 * itu open + return id-nya.
 */
export async function resolveShiftId(args: {
  userId: string;
  preferShiftId?: number | null;
}): Promise<number | null> {
  if (args.preferShiftId) {
    const s = await db.query.shiftKasir.findFirst({
      where: eq(shiftKasir.id, args.preferShiftId),
    });
    if (s && s.status === "open") return s.id;
  }
  const own = await getShiftAktif(args.userId);
  return own?.id ?? null;
}

export const SHIFT_REOPEN_WINDOW_MS = REOPEN_WINDOW_MS;

/**
 * Deteksi shift "stale" — yaitu shift open yang sudah cross-midnight
 * dibanding sekarang (timezone WIB). Pelanggaran akuntansi: omzet kemarin
 * dan hari ini akan bercampur kalau dibiarkan.
 *
 * Definition: openedAt tanggal kalender (WIB) ≠ tanggal kalender sekarang.
 */
export function isShiftStale(openedAt: Date, now: Date = new Date()): boolean {
  const tz = "Asia/Makassar"; // WIB
  const openedDay = openedAt.toLocaleDateString("id-ID", { timeZone: tz });
  const todayDay = now.toLocaleDateString("id-ID", { timeZone: tz });
  return openedDay !== todayDay;
}

/**
 * Hitung berapa shift open yang sudah stale (untuk badge nav admin).
 */
export async function countShiftStale(): Promise<number> {
  const opens = await db
    .select({ id: shiftKasir.id, openedAt: shiftKasir.openedAt })
    .from(shiftKasir)
    .where(eq(shiftKasir.status, "open"));
  return opens.filter((s) => isShiftStale(s.openedAt)).length;
}

/**
 * List shift stale dengan info kasir, untuk notif + halaman admin.
 */
export async function getShiftStaleList() {
  const rows = await db
    .select({
      id: shiftKasir.id,
      kasirUserId: shiftKasir.kasirUserId,
      kasirNama: userTable.name,
      openedAt: shiftKasir.openedAt,
      openingCash: shiftKasir.openingCash,
      staleNotifSentAt: shiftKasir.staleNotifSentAt,
    })
    .from(shiftKasir)
    .leftJoin(userTable, eq(shiftKasir.kasirUserId, userTable.id))
    .where(eq(shiftKasir.status, "open"))
    .orderBy(shiftKasir.openedAt);
  return rows.filter((s) => isShiftStale(s.openedAt));
}

/**
 * Tandai shift sudah dinotif. Pakai bareng dengan notif sender supaya
 * tidak spam (rate limit 6 jam per shift).
 */
export async function markShiftNotified(shiftId: number): Promise<void> {
  await db
    .update(shiftKasir)
    .set({ staleNotifSentAt: new Date() })
    .where(eq(shiftKasir.id, shiftId));
}

// Re-export gte/lte untuk konsumer (mis. admin shift filter range)
export { gte as _gte, lte as _lte };
