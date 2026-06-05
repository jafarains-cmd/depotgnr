import { eq } from "drizzle-orm";
import { db } from "./../db";
import { transaksi, transaksiItem } from "../db/schema/transaksi";
import { produk } from "../db/schema/produk";
import { pelanggan } from "../db/schema/pelanggan";
import { user as userTable } from "../db/schema/auth";
import { formatRupiah } from "./utils";

const JENIS_LABEL: Record<string, string> = {
  isi_ulang: "isi ulang",
  tukar: "tukar",
  beli_baru: "beli baru",
};

/**
 * Format detail transaksi untuk notif Telegram grup.
 * Output Markdown-friendly (Telegram parse_mode=Markdown).
 */
export async function formatTransaksiDetail(trxId: number): Promise<string> {
  const t = await db.query.transaksi.findFirst({ where: eq(transaksi.id, trxId) });
  if (!t) return "";

  const items = await db
    .select({
      qty: transaksiItem.qty,
      hargaSatuan: transaksiItem.hargaSatuan,
      subtotal: transaksiItem.subtotal,
      jenis: transaksiItem.jenis,
      namaProduk: produk.nama,
    })
    .from(transaksiItem)
    .leftJoin(produk, eq(transaksiItem.produkId, produk.id))
    .where(eq(transaksiItem.transaksiId, trxId));

  const pel = t.pelangganId
    ? await db.query.pelanggan.findFirst({ where: eq(pelanggan.id, t.pelangganId) })
    : null;
  const kasir = t.kasirUserId
    ? await db.query.user.findFirst({ where: eq(userTable.id, t.kasirUserId) })
    : null;

  const tgl = t.createdAt.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const totalQty = items.reduce((s, it) => s + it.qty, 0);

  const lines = [
    `🧾 *Transaksi POS*`,
    `Nota: \`${t.nomorNota}\``,
    `Waktu: ${tgl}`,
    `Kasir: ${kasir?.name ?? "—"}`,
    pel ? `Pelanggan: *${pel.nama}*${pel.telp ? ` (${pel.telp})` : ""}` : `Pelanggan: walk-in`,
    "",
    `*Item (${totalQty} galon):*`,
    ...items.map(
      (it) =>
        `• ${it.qty}× ${it.namaProduk ?? "?"} _${JENIS_LABEL[it.jenis] ?? it.jenis}_ @ ${formatRupiah(it.hargaSatuan)} = ${formatRupiah(it.subtotal)}`,
    ),
    "",
    `Subtotal: ${formatRupiah(t.subtotal)}`,
    ...(t.diskon > 0 ? [`Diskon/Loyalty: -${formatRupiah(t.diskon)}`] : []),
    `*Total: ${formatRupiah(t.total)}*`,
    `Bayar: *${t.metodeBayar.toUpperCase()}*`,
    ...(t.catatan ? [`Catatan: _${t.catatan}_`] : []),
  ];
  return lines.join("\n");
}
