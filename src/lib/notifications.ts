import { eq, and, inArray, ne, sql, gt } from "drizzle-orm";
import { db } from "@/db";
import { orderHeader } from "@/db/schema/order";
import { bonusKurir } from "@/db/schema/bonus";
import { komplain } from "@/db/schema/komplain";
import { galonDipinjam } from "@/db/schema/pelanggan";

/**
 * Hitung order yang masih in-flight (belum selesai/batal). Termasuk:
 *  - pending (baru masuk, belum diproses)
 *  - diproses, dijemput, diisi, diantar (sudah ditangani kasir/kurir tapi
 *    belum sampai/selesai — masih perlu monitoring)
 * Untuk badge "Order Antar" di nav admin/kasir.
 */
export async function countOrderMasuk(): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(orderHeader)
    .where(
      inArray(orderHeader.status, ["pending", "diproses", "dijemput", "diisi", "diantar"]),
    );
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
 * Hitung pesanan pelanggan yang masih butuh perhatian — untuk badge tab "Pesanan".
 * Termasuk:
 *   - order in-progress (pending, diproses, dijemput, diisi, diantar)
 *   - order selesai TAPI statusBayar != lunas (piutang yang harus diselesaikan pelanggan)
 * Order batal selalu di-skip.
 */
export async function countPesananBelumTuntas(pelangganId: number): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(orderHeader)
    .where(
      and(
        eq(orderHeader.pelangganId, pelangganId),
        ne(orderHeader.status, "batal"),
        sql`(${orderHeader.status} != 'selesai' OR ${orderHeader.statusBayar} != 'lunas')`,
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

/**
 * Hitung komplain status=baru (perlu admin tindak lanjut).
 */
export async function countKomplainBaru(): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(komplain)
    .where(eq(komplain.status, "baru"));
  return row.n ?? 0;
}

/**
 * Hitung komplain pelanggan yang punya update terbaru tapi belum di-tutup
 * (status diproses, atau baru tunggu tanggapan).
 */
export async function countKomplainPelangganActive(pelangganId: number): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(komplain)
    .where(
      and(
        eq(komplain.pelangganId, pelangganId),
        inArray(komplain.status, ["baru", "diproses"]),
      ),
    );
  return row.n ?? 0;
}

/**
 * Hitung berapa pelanggan yang sedang memegang galon depot (saldo > 0).
 * Untuk badge admin nav "Galon Dipinjam".
 */
export async function countPelangganDenganGalonPinjam(): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(distinct ${galonDipinjam.pelangganId})` })
    .from(galonDipinjam)
    .where(gt(galonDipinjam.jumlah, 0));
  return row.n ?? 0;
}
