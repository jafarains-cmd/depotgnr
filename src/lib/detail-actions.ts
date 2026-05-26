"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orderHeader, orderItem } from "@/db/schema/order";
import { transaksi, transaksiItem } from "@/db/schema/transaksi";
import { produk } from "@/db/schema/produk";
import { pelanggan as pelangganTable } from "@/db/schema/pelanggan";
import { user as userTable } from "@/db/schema/auth";
import { requireRole } from "@/lib/permissions";

export type DetailItem = {
  qty: number;
  hargaSatuan: number;
  subtotal: number;
  jenis: string;
  namaProduk: string;
};

export type OrderDetail = {
  kind: "order";
  id: number;
  nomorOrder: string;
  status: string;
  statusBayar: string;
  metodeBayar: string | null;
  sumber: string;
  tipePengantaran: string;
  alamatAntar: string | null;
  catatan: string | null;
  totalEstimasi: number;
  loyaltiDipakai: number;
  createdAt: string;
  diantarAt: string | null;
  selesaiAt: string | null;
  bayarAt: string | null;
  buktiFotoUrl: string | null;
  buktiBayarUrl: string | null;
  pelangganNama: string | null;
  pelangganTelp: string | null;
  kurirNama: string | null;
  konfirmasiNama: string | null;
  items: DetailItem[];
};

export type TransaksiDetail = {
  kind: "transaksi";
  id: number;
  nomorNota: string;
  metodeBayar: string;
  status: string;
  subtotal: number;
  diskon: number;
  total: number;
  catatan: string | null;
  createdAt: string;
  voidedAt: string | null;
  voidedAlasan: string | null;
  pelangganNama: string | null;
  pelangganTelp: string | null;
  kasirNama: string | null;
  items: DetailItem[];
};

export async function getOrderDetail(orderId: number): Promise<OrderDetail | null> {
  await requireRole(["admin", "kasir"]);
  const o = await db.query.orderHeader.findFirst({
    where: eq(orderHeader.id, orderId),
  });
  if (!o) return null;

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

  const pel = o.pelangganId
    ? await db.query.pelanggan.findFirst({ where: eq(pelangganTable.id, o.pelangganId) })
    : null;
  const kurir = o.kurirUserId
    ? await db.query.user.findFirst({ where: eq(userTable.id, o.kurirUserId) })
    : null;
  const konfirmator = o.bayarDikonfirmasiOleh
    ? await db.query.user.findFirst({ where: eq(userTable.id, o.bayarDikonfirmasiOleh) })
    : null;

  return {
    kind: "order",
    id: o.id,
    nomorOrder: o.nomorOrder,
    status: o.status,
    statusBayar: o.statusBayar,
    metodeBayar: o.metodeBayar,
    sumber: o.sumber,
    tipePengantaran: o.tipePengantaran,
    alamatAntar: o.alamatAntar,
    catatan: o.catatan,
    totalEstimasi: o.totalEstimasi,
    loyaltiDipakai: o.loyaltiDipakai,
    createdAt: o.createdAt.toISOString(),
    diantarAt: o.diantarAt?.toISOString() ?? null,
    selesaiAt: o.selesaiAt?.toISOString() ?? null,
    bayarAt: o.bayarAt?.toISOString() ?? null,
    buktiFotoUrl: o.buktiFotoUrl,
    buktiBayarUrl: o.buktiBayarUrl,
    pelangganNama: pel?.nama ?? null,
    pelangganTelp: pel?.telp ?? null,
    kurirNama: kurir?.name ?? null,
    konfirmasiNama: konfirmator?.name ?? null,
    items: items.map((it) => ({
      qty: it.qty,
      hargaSatuan: it.hargaEstimasi ?? 0,
      subtotal: (it.hargaEstimasi ?? 0) * it.qty,
      jenis: it.jenis,
      namaProduk: it.namaProduk ?? "-",
    })),
  };
}

export async function getTransaksiDetail(
  trxId: number,
): Promise<TransaksiDetail | null> {
  await requireRole(["admin", "kasir"]);
  const t = await db.query.transaksi.findFirst({ where: eq(transaksi.id, trxId) });
  if (!t) return null;

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
    ? await db.query.pelanggan.findFirst({ where: eq(pelangganTable.id, t.pelangganId) })
    : null;
  const kasir = t.kasirUserId
    ? await db.query.user.findFirst({ where: eq(userTable.id, t.kasirUserId) })
    : null;

  return {
    kind: "transaksi",
    id: t.id,
    nomorNota: t.nomorNota,
    metodeBayar: t.metodeBayar,
    status: t.status,
    subtotal: t.subtotal,
    diskon: t.diskon,
    total: t.total,
    catatan: t.catatan,
    createdAt: t.createdAt.toISOString(),
    voidedAt: t.voidedAt?.toISOString() ?? null,
    voidedAlasan: t.voidedAlasan,
    pelangganNama: pel?.nama ?? null,
    pelangganTelp: pel?.telp ?? null,
    kasirNama: kasir?.name ?? null,
    items: items.map((it) => ({
      qty: it.qty,
      hargaSatuan: it.hargaSatuan,
      subtotal: it.subtotal,
      jenis: it.jenis,
      namaProduk: it.namaProduk ?? "-",
    })),
  };
}
