"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/permissions";
import {
  bukaShift as bukaShiftLib,
  tutupShift as tutupShiftLib,
  reopenShift as reopenShiftLib,
  ringkasanShift,
} from "@/lib/shift";
import { logAudit } from "@/lib/audit";
import { notifGrupOrder, notifAdminTelegram } from "@/lib/telegram";
import { formatRupiah } from "@/lib/utils";
import { db } from "@/db";
import { shiftKasir } from "@/db/schema/shift";
import { eq } from "drizzle-orm";
import { user as userTable } from "@/db/schema/auth";
import { bestEffort } from "@/lib/best-effort";
import { uploadAsset } from "@/lib/drive";

export async function bukaShiftAction(
  openingCash: number | null,
): Promise<{ ok: true; shiftId: number } | { error: string }> {
  const session = await requireRole(["admin", "kasir"]);
  const r = await bukaShiftLib({
    kasirUserId: session.user.id,
    openingCash: openingCash !== null && Number.isFinite(openingCash) ? Math.max(0, Math.floor(openingCash)) : null,
  });
  if ("error" in r) return r;

  await logAudit({
    actorUserId: session.user.id,
    action: "shift.buka",
    entity: "shift_kasir",
    entityId: r.shiftId,
    after: { openingCash },
  });

  revalidatePath("/kasir/shift");
  revalidatePath("/kasir");
  return r;
}

export async function tutupShiftAction(args: {
  shiftId: number;
  closingCashCounted: number;
  catatan?: string;
  buktiBase64?: string | null;
  buktiMimeType?: string | null;
}): Promise<
  | { ok: true; selisih: number; expected: number }
  | { error: string }
> {
  const session = await requireRole(["admin", "kasir"]);
  if (!Number.isFinite(args.closingCashCounted) || args.closingCashCounted < 0) {
    return { error: "Jumlah uang fisik wajib (>= 0)" };
  }

  // Upload bukti foto kalau ada (best-effort: kalau gagal, lanjut tanpa foto)
  let buktiFotoUrl: string | null = null;
  if (args.buktiBase64 && args.buktiMimeType) {
    const up = await uploadAsset({
      prefix: `shift-${args.shiftId}`,
      base64: args.buktiBase64,
      mimeType: args.buktiMimeType,
    });
    if (up.ok && up.url) buktiFotoUrl = up.url;
  }

  const r = await tutupShiftLib({
    shiftId: args.shiftId,
    closingCashCounted: Math.floor(args.closingCashCounted),
    catatan: args.catatan,
    buktiFotoUrl,
    closedByUserId: session.user.id,
  });
  if ("error" in r) return r;

  await logAudit({
    actorUserId: session.user.id,
    action: "shift.tutup",
    entity: "shift_kasir",
    entityId: args.shiftId,
    after: {
      closingCashCounted: args.closingCashCounted,
      expected: r.expected,
      selisih: r.selisih,
    },
    meta: { catatan: args.catatan },
  });

  // Kirim notif detail ke grup Telegram (best-effort)
  bestEffort("notifShiftTutup", notifShiftTutup(args.shiftId, session.user.name));

  revalidatePath("/kasir/shift");
  revalidatePath("/kasir");
  revalidatePath("/admin/shift");
  return r;
}

/**
 * Force-close shift kasir lain (admin only). Untuk skenario lupa tutup
 * atau kasir resign. Wajib alasan. Bisa input uang fisik atau biarkan 0.
 */
export async function forceCloseShiftAction(args: {
  shiftId: number;
  closingCashCounted: number;
  alasan: string;
}): Promise<
  | { ok: true; selisih: number; expected: number }
  | { error: string }
> {
  const session = await requireRole(["admin"]);
  const alasan = args.alasan.trim();
  if (alasan.length < 3) return { error: "Alasan force-close wajib (min 3 karakter)" };
  if (!Number.isFinite(args.closingCashCounted) || args.closingCashCounted < 0) {
    return { error: "Jumlah uang fisik harus >= 0 (input 0 kalau tidak tahu)" };
  }

  const r = await tutupShiftLib({
    shiftId: args.shiftId,
    closingCashCounted: Math.floor(args.closingCashCounted),
    catatan: `[FORCE-CLOSE oleh admin ${session.user.name}] ${alasan}`,
    buktiFotoUrl: null,
    closedByUserId: session.user.id,
  });
  if ("error" in r) return r;

  await logAudit({
    actorUserId: session.user.id,
    action: "shift.force-close",
    entity: "shift_kasir",
    entityId: args.shiftId,
    after: {
      closingCashCounted: args.closingCashCounted,
      expected: r.expected,
      selisih: r.selisih,
    },
    meta: { alasan, forceClose: true },
  });

  bestEffort("notifShiftTutup(force)", notifShiftTutup(args.shiftId, session.user.name));

  revalidatePath("/kasir/shift");
  revalidatePath("/admin/shift");
  revalidatePath("/admin");
  return r;
}

/**
 * Edit nominal shift (uang awal / uang fisik tutup). Untuk kasus typo
 * (mis. 115 → 115000) atau lupa hitung dan baru ingat.
 *
 * Akses:
 *  - Shift OPEN: pemilik shift atau admin (hanya bisa edit uang awal)
 *  - Shift CLOSED: ADMIN ONLY (bisa edit uang awal + uang fisik)
 *
 * Untuk closed shift, sistem otomatis recompute closing_cash_expected &
 * selisih:
 *   expected_baru = opening_baru + omzet_cash - pengeluaran
 *   selisih_baru = uang_fisik_baru - expected_baru
 *
 * Pass null untuk skip field yang tidak diedit.
 * Alasan wajib untuk audit trail.
 */
export async function editShiftCashAction(args: {
  shiftId: number;
  newOpeningCash?: number | null;
  newClosingCashCounted?: number | null;
  alasan: string;
}): Promise<
  | { ok: true; recomputed?: { expected: number; selisih: number } }
  | { error: string }
> {
  const session = await requireRole(["admin", "kasir"]);
  const alasan = args.alasan.trim();
  if (alasan.length < 3) return { error: "Alasan wajib (min 3 karakter)" };
  if (
    args.newOpeningCash === undefined &&
    args.newClosingCashCounted === undefined
  ) {
    return { error: "Tidak ada perubahan" };
  }
  if (
    args.newOpeningCash != null &&
    (!Number.isFinite(args.newOpeningCash) || args.newOpeningCash < 0)
  ) {
    return { error: "Uang awal harus angka >= 0" };
  }
  if (
    args.newClosingCashCounted != null &&
    (!Number.isFinite(args.newClosingCashCounted) || args.newClosingCashCounted < 0)
  ) {
    return { error: "Uang fisik harus angka >= 0" };
  }

  const shift = await db.query.shiftKasir.findFirst({
    where: eq(shiftKasir.id, args.shiftId),
  });
  if (!shift) return { error: "Shift tidak ditemukan" };

  const isPemilik = shift.kasirUserId === session.user.id;
  const isAdmin = session.user.role === "admin";

  if (shift.status === "open") {
    if (!isPemilik && !isAdmin) {
      return { error: "Hanya pemilik shift atau admin yang bisa edit" };
    }
    if (args.newClosingCashCounted != null) {
      return { error: "Shift masih open — uang fisik diinput saat tutup, bukan di-edit" };
    }
  } else {
    if (!isAdmin) {
      return { error: "Shift sudah ditutup. Hanya admin yang bisa edit." };
    }
  }

  const oldOpening = shift.openingCash;
  const oldCounted = shift.closingCashCounted;

  const updates: Partial<typeof shiftKasir.$inferInsert> = {};
  if (args.newOpeningCash != null) {
    updates.openingCash = Math.floor(args.newOpeningCash);
  }
  if (args.newClosingCashCounted != null) {
    updates.closingCashCounted = Math.floor(args.newClosingCashCounted);
  }

  await db.update(shiftKasir).set(updates).where(eq(shiftKasir.id, args.shiftId));

  let recomputed: { expected: number; selisih: number } | undefined;

  // Recompute selisih untuk closed shift
  if (shift.status === "closed") {
    const ring = await ringkasanShift(args.shiftId);
    const expectedBaru = ring.expected;
    const countedBaru =
      args.newClosingCashCounted != null
        ? Math.floor(args.newClosingCashCounted)
        : (shift.closingCashCounted ?? 0);
    const selisihBaru = countedBaru - expectedBaru;
    await db
      .update(shiftKasir)
      .set({ closingCashExpected: expectedBaru, selisih: selisihBaru })
      .where(eq(shiftKasir.id, args.shiftId));
    recomputed = { expected: expectedBaru, selisih: selisihBaru };
  }

  await logAudit({
    actorUserId: session.user.id,
    action: "shift.edit-cash",
    entity: "shift_kasir",
    entityId: args.shiftId,
    before: {
      openingCash: oldOpening,
      closingCashCounted: oldCounted,
      closingCashExpected: shift.closingCashExpected,
      selisih: shift.selisih,
    },
    after: {
      openingCash: updates.openingCash ?? oldOpening,
      closingCashCounted: updates.closingCashCounted ?? oldCounted,
      ...(recomputed ?? {}),
    },
    meta: { alasan, status: shift.status },
  });

  revalidatePath("/kasir/shift");
  revalidatePath("/admin/shift");
  revalidatePath("/admin");
  return { ok: true, recomputed };
}

/** @deprecated Pakai editShiftCashAction. Tetap di-export untuk backward-compat call sites. */
export async function editOpeningCashAction(args: {
  shiftId: number;
  newOpeningCash: number;
  alasan: string;
}) {
  return editShiftCashAction({
    shiftId: args.shiftId,
    newOpeningCash: args.newOpeningCash,
    alasan: args.alasan,
  });
}

export async function reopenShiftAction(
  shiftId: number,
): Promise<{ ok: true } | { error: string }> {
  const session = await requireRole(["admin", "kasir"]);
  const r = await reopenShiftLib({
    shiftId,
    reopenedByUserId: session.user.id,
  });
  if ("error" in r) return r;

  await logAudit({
    actorUserId: session.user.id,
    action: "shift.reopen",
    entity: "shift_kasir",
    entityId: shiftId,
  });

  revalidatePath("/kasir/shift");
  revalidatePath("/admin/shift");
  return r;
}

async function notifShiftTutup(shiftId: number, closedByName: string): Promise<void> {
  const shift = await db.query.shiftKasir.findFirst({
    where: eq(shiftKasir.id, shiftId),
  });
  if (!shift) return;
  const kasir = await db.query.user.findFirst({ where: eq(userTable.id, shift.kasirUserId) });
  const ringkasan = await ringkasanShift(shiftId);
  const isTakeover = closedByName !== (kasir?.name ?? "");

  const lines = [
    `🔒 *Shift Kasir Ditutup*`,
    `Kasir: *${kasir?.name ?? "—"}*${isTakeover ? ` (ditutup oleh ${closedByName})` : ""}`,
    `Buka: ${shift.openedAt.toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}`,
    `Tutup: ${new Date().toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}`,
    "",
    `📊 Transaksi: ${ringkasan.jumlahTransaksi} | Order lunas: ${ringkasan.jumlahOrder}`,
    `Omzet cash: ${formatRupiah(ringkasan.omzetCash)}`,
    ringkasan.omzetTransfer > 0 ? `Omzet transfer: ${formatRupiah(ringkasan.omzetTransfer)}` : "",
    ringkasan.omzetQris > 0 ? `Omzet QRIS: ${formatRupiah(ringkasan.omzetQris)}` : "",
    ringkasan.totalPengeluaran > 0
      ? `Pengeluaran: ${formatRupiah(ringkasan.totalPengeluaran)} (${ringkasan.jumlahPengeluaran}x)`
      : "",
    "",
    shift.openingCash !== null ? `💵 Uang awal: ${formatRupiah(shift.openingCash)}` : "",
    `💵 Ekspektasi cash: ${formatRupiah(ringkasan.expected)}`,
    `💵 Uang fisik dihitung: ${formatRupiah(shift.closingCashCounted ?? 0)}`,
    shift.selisih !== null && shift.selisih !== 0
      ? `${shift.selisih > 0 ? "🟢 Lebih" : "🔴 Kurang"}: ${formatRupiah(Math.abs(shift.selisih))}`
      : "✓ Pas",
    shift.catatan ? `\n_${shift.catatan}_` : "",
  ].filter(Boolean);

  const text = lines.join("\n");
  try {
    await notifGrupOrder("selesai", text);
  } catch {
    await notifAdminTelegram(text);
  }
}
