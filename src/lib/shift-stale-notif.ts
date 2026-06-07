import { eq } from "drizzle-orm";
import { db } from "@/db";
import { pengaturan } from "@/db/schema/pengaturan";
import { getShiftStaleList, markShiftNotified, ringkasanShift } from "./shift";
import { notifGrupOrder } from "./telegram";
import { sendWhatsAppGroup } from "./whatsapp";
import { formatRupiah } from "./utils";
import { bestEffort } from "./best-effort";

const RATE_LIMIT_MS = 6 * 60 * 60 * 1000; // 6 jam

/**
 * Scan semua shift stale, kirim notif ke grup WA + Telegram untuk yang
 * belum dinotif dalam 6 jam terakhir. Idempotent — aman dipanggil sering
 * (mis. dari middleware atau halaman admin layout).
 */
export async function notifStaleShiftsIfNeeded(): Promise<{
  sent: number;
  skipped: number;
}> {
  const stales = await getShiftStaleList();
  let sent = 0;
  let skipped = 0;

  // Ambil WA group ID dari pengaturan (sama dengan notif order)
  const waGroupRow = await db.query.pengaturan.findFirst({
    where: eq(pengaturan.key, "waGroupOrderMasuk"),
  });
  const waGroupId = waGroupRow?.value?.trim();

  for (const s of stales) {
    const now = Date.now();
    if (s.staleNotifSentAt && now - s.staleNotifSentAt.getTime() < RATE_LIMIT_MS) {
      skipped++;
      continue;
    }

    // Build message
    const ringkasan = await ringkasanShift(s.id);
    const hours = Math.round((now - s.openedAt.getTime()) / (60 * 60 * 1000));
    const openedStr = s.openedAt.toLocaleString("id-ID", {
      timeZone: "Asia/Makassar",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

    const text =
      `⚠ *Lupa Tutup Shift*\n` +
      `Kasir: *${s.kasirNama ?? "—"}*\n` +
      `Buka shift: ${openedStr} (${hours} jam lalu)\n` +
      `\n` +
      `Sementara ini:\n` +
      `• Transaksi: ${ringkasan.jumlahTransaksi}\n` +
      `• Omzet cash: ${formatRupiah(ringkasan.omzetCash)}\n` +
      (ringkasan.omzetTransfer > 0
        ? `• Omzet transfer: ${formatRupiah(ringkasan.omzetTransfer)}\n`
        : "") +
      (ringkasan.omzetQris > 0 ? `• Omzet QRIS: ${formatRupiah(ringkasan.omzetQris)}\n` : "") +
      `\n` +
      `Mohon segera tutup shift atau admin force-close di /admin/shift supaya recap akurat.`;

    bestEffort(`notifGrupOrder(stale:${s.id})`, notifGrupOrder("pending", text));
    if (waGroupId) {
      bestEffort(`waGroupStale(${s.id})`, sendWhatsAppGroup(waGroupId, text));
    }

    await markShiftNotified(s.id);
    sent++;
  }

  return { sent, skipped };
}
