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
 * Hitung pembayaran yang butuh tindakan staff:
 *  - statusBayar = 'menunggu' (bukti pelanggan sudah masuk, perlu verifikasi)
 *  - ATAU status='selesai' + statusBayar='belum' (PIUTANG — sudah diantar tapi belum lunas)
 * Match dengan tab "Menunggu Verifikasi" + "Piutang" di /pembayaran.
 */
export async function countPembayaranMenunggu(): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(orderHeader)
    .where(
      and(
        ne(orderHeader.status, "batal"),
        sql`(${orderHeader.statusBayar} = 'menunggu' OR (${orderHeader.status} = 'selesai' AND ${orderHeader.statusBayar} = 'belum'))`,
      ),
    );
  return row.n ?? 0;
}

/**
 * Hitung pesanan pelanggan yang masih in-progress — untuk badge tab "Pesanan" di nav pelanggan.
 * Hanya order dengan status BUKAN selesai/batal (pending, diproses, dijemput, diisi, diantar).
 * Order selesai tetap tidak dihitung walau statusBayar belum lunas — pelanggan sudah dapat
 * barangnya, tidak perlu di-nudge dari badge.
 */
export async function countPesananBelumTuntas(pelangganId: number): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(orderHeader)
    .where(
      and(
        eq(orderHeader.pelangganId, pelangganId),
        ne(orderHeader.status, "batal"),
        ne(orderHeader.status, "selesai"),
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
