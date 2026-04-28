import { NextResponse } from "next/server";
import { ensureSheets, pushAllProduk, pullProdukFromSheet } from "@/lib/sheets";

export const dynamic = "force-dynamic";

/**
 * Endpoint cron untuk Sheets sync.
 * Lindungi dengan header `x-sync-secret` (env SYNC_SECRET) atau Vercel Cron auth.
 */
export async function POST(req: Request) {
  const expected = process.env.SYNC_SECRET;
  if (expected && req.headers.get("x-sync-secret") !== expected) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const op = url.searchParams.get("op") ?? "all";

  if (op === "ensure") return NextResponse.json(await ensureSheets());
  if (op === "push-produk") return NextResponse.json(await pushAllProduk());
  if (op === "pull-produk") return NextResponse.json(await pullProdukFromSheet());

  // op = "all" — push produk + pull produk
  const a = await pushAllProduk();
  const b = await pullProdukFromSheet();
  return NextResponse.json({ pushProduk: a, pullProduk: b });
}

export async function GET() {
  return new Response("Sheets sync endpoint. Use POST.", { status: 200 });
}
