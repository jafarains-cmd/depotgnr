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
