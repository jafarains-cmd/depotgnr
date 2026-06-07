import { eq, and, sql, lt } from "drizzle-orm";
import { db } from "@/db";
import { orderHeader } from "@/db/schema/order";
import { pengaturan } from "@/db/schema/pengaturan";

const DEFAULT_THRESHOLD = 30;

/**
 * Ambil threshold piutang menua dari pengaturan. 0 = nonaktif.
 */
export async function getPiutangThreshold(): Promise<number> {
  const row = await db.query.pengaturan.findFirst({
    where: eq(pengaturan.key, "thresholdPiutangMenuaHari"),
  });
  const n = Number(row?.value);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_THRESHOLD;
  return Math.floor(n);
}

/**
 * Hitung berapa order piutang yang sudah > threshold hari. Untuk badge nav
 * / banner alert di /pembayaran. Threshold 0 → return 0.
 */
export async function countPiutangMenua(): Promise<number> {
  const threshold = await getPiutangThreshold();
  if (threshold === 0) return 0;
  const cutoff = new Date(Date.now() - threshold * 24 * 60 * 60 * 1000);
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(orderHeader)
    .where(
      and(
        eq(orderHeader.status, "selesai"),
        eq(orderHeader.statusBayar, "belum"),
        lt(orderHeader.selesaiAt, cutoff),
      ),
    );
  return Number(row?.n ?? 0);
}

/**
 * Hitung umur piutang dalam hari berdasarkan selesaiAt (fallback createdAt).
 */
export function umurPiutangHari(selesaiAt: Date | string | null, createdAt: Date | string): number {
  const ref = selesaiAt
    ? typeof selesaiAt === "string"
      ? new Date(selesaiAt)
      : selesaiAt
    : typeof createdAt === "string"
      ? new Date(createdAt)
      : createdAt;
  const ms = Date.now() - ref.getTime();
  return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));
}
