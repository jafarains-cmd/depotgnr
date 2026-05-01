import { NextResponse } from "next/server";
import { lt } from "drizzle-orm";
import { db } from "@/db";
import { lokasiKurir } from "@/db/schema/order";
import { TRACKING_TTL_DAYS } from "@/lib/constants";

export const dynamic = "force-dynamic";

/**
 * Endpoint cleanup data lama. Jadwalkan via systemd timer / cron:
 *   curl -H "x-cron-secret: $CRON_SECRET" https://depot.genster.my.id/api/cron/cleanup
 * Atau dari host langsung: `0 3 * * 0 curl ...` (jam 3 pagi tiap minggu).
 *
 * Yang dibersihkan:
 *  - lokasi_kurir > TRACKING_TTL_DAYS (30 hari)
 *
 * ENV: CRON_SECRET (wajib di production untuk mencegah abuse public).
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
    const got = req.headers.get("x-cron-secret") ?? url.searchParams.get("secret");
    if (got !== expected) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    // Production tanpa CRON_SECRET = bahaya
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET tidak diset di env (wajib di production)" },
      { status: 503 },
    );
  }

  const cutoff = new Date(Date.now() - TRACKING_TTL_DAYS * 24 * 60 * 60 * 1000);

  const result = await db
    .delete(lokasiKurir)
    .where(lt(lokasiKurir.createdAt, cutoff));

  return NextResponse.json({
    ok: true,
    cleaned: {
      lokasiKurir: result.changes,
    },
    cutoff: cutoff.toISOString(),
  });
}
