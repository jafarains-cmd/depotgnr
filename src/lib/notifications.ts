import { eq, and, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { orderHeader } from "@/db/schema/order";

/**
 * Hitung order baru masuk yang belum di-tindak kasir (status pending).
 */
export async function countOrderMasuk(): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(orderHeader)
    .where(eq(orderHeader.status, "pending"));
  return row.n ?? 0;
}

/**
 * Hitung pembayaran online yang menunggu verifikasi (bukti sudah masuk).
 */
export async function countPembayaranMenunggu(): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(orderHeader)
    .where(
      and(
        eq(orderHeader.statusBayar, "menunggu"),
        ne(orderHeader.status, "batal"),
      ),
    );
  return row.n ?? 0;
}

/**
 * Hitung order aktif yang ditugaskan ke kurir (atau kasir/admin yang merangkap).
 * Untuk badge "Mode Kurir" di sidebar — counts hanya order yang sedang in-flight.
 */
export async function countKurirAktif(userId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(orderHeader)
    .where(
      and(
        eq(orderHeader.kurirUserId, userId),
        inArray(orderHeader.status, ["diproses", "dijemput", "diisi", "diantar"]),
      ),
    );
  return row.n ?? 0;
}
