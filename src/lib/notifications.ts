import { eq, and, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { orderHeader } from "@/db/schema/order";
import { bonusKurir } from "@/db/schema/bonus";

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
 * Hitung pesanan pelanggan yang belum tuntas — untuk badge tab "Pesanan" di nav pelanggan.
 * Termasuk:
 *  - Order yang masih in-progress (status BUKAN selesai/batal), ATAU
 *  - Order selesai tapi belum lunas (statusBayar belum/menunggu)
 */
export async function countPesananBelumTuntas(pelangganId: number): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(orderHeader)
    .where(
      and(
        eq(orderHeader.pelangganId, pelangganId),
        ne(orderHeader.status, "batal"),
        sql`(${orderHeader.status} != 'selesai' OR ${orderHeader.statusBayar} IN ('belum', 'menunggu'))`,
      ),
    );
  return row.n ?? 0;
}

/**
 * Hitung jumlah kurir yang masih punya bonus pending (belum dibayar owner).
 * Distinct kurirUserId. Untuk badge "Bonus Kurir" di sidebar admin.
 */
export async function countKurirBonusPending(): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(distinct ${bonusKurir.kurirUserId})` })
    .from(bonusKurir)
    .where(eq(bonusKurir.status, "pending"));
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
