import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orderHeader, orderItem } from "@/db/schema/order";
import { transaksi, transaksiItem } from "@/db/schema/transaksi";
import { generateNomorNota } from "./utils";

/**
 * Sync order lunas → transaksi. Idempoten: kalau sudah ada transaksi dengan
 * refOrderId yang sama, skip. Dipanggil saat:
 *  - Order COD selesai (statusBayar=lunas otomatis)
 *  - Admin konfirmasi bukti bayar (statusBayar: menunggu/belum → lunas)
 *  - Admin tandai lunas piutang (statusBayar: belum → lunas)
 *
 * Tujuan: laporan & dashboard yang query tabel `transaksi` jadi mencakup
 * semua revenue (cash POS + order antar) — bukan hanya cash POS.
 */
export async function syncTransaksiFromOrder(orderId: number): Promise<void> {
  const o = await db.query.orderHeader.findFirst({
    where: eq(orderHeader.id, orderId),
  });
  if (!o) return;
  if (o.status !== "selesai" || o.statusBayar !== "lunas") return;

  // Cek idempotency
  const existing = await db.query.transaksi.findFirst({
    where: eq(transaksi.refOrderId, orderId),
  });
  if (existing) return;

  // Ambil items
  const items = await db.query.orderItem.findMany({
    where: eq(orderItem.orderId, orderId),
  });
  if (items.length === 0) return;

  const subtotal = items.reduce((s, it) => s + it.hargaEstimasi * it.qty, 0);
  const diskon = o.loyaltiDipakai;
  const total = Math.max(0, subtotal - diskon);

  const nomorNota = generateNomorNota("NOTA");
  // Pakai timestamp asli order (urutan: selesaiAt → bayarAt → diantarAt → createdAt)
  // supaya laporan harian/grafik mencerminkan tanggal kejadian sebenarnya.
  const createdAt = o.selesaiAt ?? o.bayarAt ?? o.diantarAt ?? o.createdAt;

  // Map metode order → transaksi enum (transaksi cuma support cash/transfer/qris)
  // COD/DANA → fallback ke 'cash' / 'transfer'
  const metodeMap: Record<string, "cash" | "transfer" | "qris"> = {
    cash: "cash",
    cod: "cash",
    transfer: "transfer",
    dana: "transfer",
    qris: "qris",
  };
  const metodeBayar = metodeMap[o.metodeBayar ?? "cash"] ?? "cash";

  await db.transaction((tx) => {
    const inserted = tx
      .insert(transaksi)
      .values({
        nomorNota,
        kasirUserId: o.kurirUserId, // dianggap "diterima oleh" kurir/staff yang antar
        pelangganId: o.pelangganId,
        subtotal,
        diskon,
        total,
        metodeBayar,
        status: "lunas",
        catatan: `Auto-sync dari order ${o.nomorOrder}`,
        refOrderId: orderId,
        createdAt,
      })
      .returning({ id: transaksi.id })
      .all();

    const trxId = inserted[0]?.id;
    if (!trxId) return;

    for (const it of items) {
      tx.insert(transaksiItem)
        .values({
          transaksiId: trxId,
          produkId: it.produkId,
          qty: it.qty,
          hargaSatuan: it.hargaEstimasi,
          subtotal: it.hargaEstimasi * it.qty,
          jenis: it.jenis,
        })
        .run();
    }
  });
}

/**
 * Saat order dibatalkan (post-lunas), void transaksi terkait supaya tidak
 * tetap dihitung di laporan. Idempoten — skip kalau tidak ada atau sudah voided.
 */
export async function voidTransaksiFromOrder(
  orderId: number,
  voidedBy: string,
  alasan: string,
): Promise<void> {
  const t = await db.query.transaksi.findFirst({
    where: eq(transaksi.refOrderId, orderId),
  });
  if (!t || t.voidedAt) return;

  await db
    .update(transaksi)
    .set({
      voidedAt: new Date(),
      voidedBy,
      voidedAlasan: alasan,
    })
    .where(eq(transaksi.id, t.id));
}
