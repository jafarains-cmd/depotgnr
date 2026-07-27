import { NextResponse } from "next/server";
import { getPiutangNeedReminder } from "@/lib/reminder-piutang";
import { notifAdminTelegram } from "@/lib/telegram";
import { formatRupiah } from "@/lib/utils";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Daily cron — cek piutang menua yang butuh reminder + kirim notif
 * Telegram admin. Admin lalu buka /pembayaran → klik "Kirim WA" per
 * pelanggan (semi-manual via wa.me link).
 *
 * Jadwalkan via systemd timer atau cron:
 *   0 9 * * * curl -H "x-cron-secret: $CRON_SECRET" \
 *     https://depot.genster.my.id/api/cron/reminder-piutang
 * (Jam 9 pagi setiap hari — jam kerja depot dimulai)
 *
 * Response:
 *  - count: total piutang butuh reminder
 *  - byStage: breakdown per stage (1/2/3)
 *  - notifSent: true kalau ada yang di-notif ke Telegram
 */
export async function POST(req: Request) {
  return handle(req);
}

export async function GET(req: Request) {
  return handle(req);
}

async function handle(req: Request) {
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const url = new URL(req.url);
    const got =
      req.headers.get("x-cron-secret") ?? url.searchParams.get("secret");
    if (got !== expected) {
      return NextResponse.json(
        { ok: false, error: "unauthorized" },
        { status: 401 },
      );
    }
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET tidak diset di env" },
      { status: 503 },
    );
  }

  const perlu = await getPiutangNeedReminder();

  const byStage = { 1: 0, 2: 0, 3: 0 };
  let totalNilai = 0;
  for (const r of perlu) {
    byStage[r.currentStage]++;
    totalNilai += r.totalPiutang;
  }

  let notifSent = false;
  if (perlu.length > 0) {
    const lines = [
      `🔔 REMINDER PIUTANG HARIAN`,
      ``,
      `Total: ${perlu.length} pelanggan perlu di-reminder`,
      `Nilai: ${formatRupiah(totalNilai)}`,
      ``,
      `Breakdown:`,
      byStage[1] > 0 ? `• Stage 1 (H+7 sopan): ${byStage[1]}` : null,
      byStage[2] > 0 ? `• Stage 2 (H+14 tegas): ${byStage[2]}` : null,
      byStage[3] > 0 ? `• Stage 3 (H+30 last): ${byStage[3]}` : null,
      ``,
      `Top 5 tertua:`,
    ].filter(Boolean) as string[];

    const top5 = perlu.slice(0, 5);
    for (const p of top5) {
      lines.push(
        `• ${p.pelangganNama} — ${formatRupiah(p.totalPiutang)} (${p.daysAge}h)`,
      );
    }
    if (perlu.length > 5) {
      lines.push(``, `...dan ${perlu.length - 5} lainnya`);
    }
    lines.push(``, `Buka: /pembayaran → section "Perlu Kirim WA"`);

    try {
      await notifAdminTelegram(lines.join("\n"));
      notifSent = true;
    } catch (err) {
      console.warn(`[cron reminder-piutang] Gagal kirim notif:`, err);
    }

    await logAudit({
      actorUserId: null,
      action: "cron.reminder-piutang",
      entity: "system",
      entityId: "reminder-piutang",
      meta: {
        count: perlu.length,
        totalNilai,
        byStage,
        notifSent,
      },
    });
  }

  return NextResponse.json({
    ok: true,
    count: perlu.length,
    totalNilai,
    byStage,
    notifSent,
    ranAt: new Date().toISOString(),
  });
}
