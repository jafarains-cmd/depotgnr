"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orderHeader, orderItem } from "@/db/schema/order";
import { pelanggan as pelangganTable } from "@/db/schema/pelanggan";
import { produk } from "@/db/schema/produk";
import { pengaturan } from "@/db/schema/pengaturan";
import { requireSession } from "@/lib/permissions";
import { formatRupiah } from "@/lib/utils";

/**
 * Format teks nota plain (untuk WA/copy-paste).
 * Hanya bisa diakses oleh pemilik order.
 */
export async function getOrderNotaText(orderId: number): Promise<string> {
  const session = await requireSession();
  const o = await db.query.orderHeader.findFirst({ where: eq(orderHeader.id, orderId) });
  if (!o) return "";
  const pel = o.pelangganId
    ? await db.query.pelanggan.findFirst({ where: eq(pelangganTable.id, o.pelangganId) })
    : null;
  if (!pel || pel.userId !== session.user.id) return "";
  if (o.statusBayar !== "lunas") return "";

  const items = await db
    .select({
      qty: orderItem.qty,
      hargaEstimasi: orderItem.hargaEstimasi,
      jenis: orderItem.jenis,
      namaProduk: produk.nama,
    })
    .from(orderItem)
    .leftJoin(produk, eq(orderItem.produkId, produk.id))
    .where(eq(orderItem.orderId, orderId));

  const cfgRows = await db.query.pengaturan.findMany();
  const cfg = Object.fromEntries(cfgRows.map((r) => [r.key, r.value ?? ""]));

  const lines: string[] = [];
  lines.push(`*${cfg.namaDepot || "Depot Air Minum"}*`);
  if (cfg.alamatDepot) lines.push(cfg.alamatDepot);
  if (cfg.telpDepot) lines.push(`Telp: ${cfg.telpDepot}`);
  lines.push("─".repeat(28));
  lines.push(`No: ${o.nomorOrder}`);
  lines.push(`Tgl: ${o.createdAt.toLocaleString("id-ID")}`);
  lines.push(`Pelanggan: ${pel.nama}`);
  lines.push("─".repeat(28));
  for (const it of items) {
    lines.push(
      `${it.qty}× ${it.namaProduk ?? "-"} (${it.jenis}) — ${formatRupiah((it.hargaEstimasi ?? 0) * it.qty)}`,
    );
  }
  lines.push("─".repeat(28));
  if (o.loyaltiDipakai > 0) {
    lines.push(`Saldo loyalty: -${formatRupiah(o.loyaltiDipakai)}`);
  }
  lines.push(`*TOTAL: ${formatRupiah(o.totalEstimasi - o.loyaltiDipakai)}*`);
  if (o.metodeBayar) lines.push(`Bayar: ${o.metodeBayar.toUpperCase()}`);
  lines.push(`Status: ${o.statusBayar.toUpperCase()}`);
  if (o.catatan) {
    lines.push("─".repeat(28));
    lines.push(`Catatan: ${o.catatan}`);
  }
  lines.push("─".repeat(28));
  lines.push(cfg.footerNota || "Terima kasih 🙏");
  return lines.join("\n");
}
