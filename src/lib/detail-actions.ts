"use server";

import { eq, and, ne, sql, isNull } from "drizzle-orm";
import { db } from "@/db";
import { orderHeader, orderItem } from "@/db/schema/order";
import { transaksi, transaksiItem } from "@/db/schema/transaksi";
import { produk } from "@/db/schema/produk";
import {
  pelanggan as pelangganTable,
  galonPelanggan,
  mutasiLoyalti,
  galonDipinjam,
} from "@/db/schema/pelanggan";
import { user as userTable } from "@/db/schema/auth";
import { shiftKasir } from "@/db/schema/shift";
import { pengeluaran } from "@/db/schema/pengeluaran";
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
  pelangganId: number | null;
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
  pelangganId: number | null;
  pelangganNama: string | null;
  pelangganTelp: string | null;
  kasirNama: string | null;
  items: DetailItem[];
};

export type ShiftDetail = {
  kind: "shift";
  id: number;
  kasirNama: string;
  status: "open" | "closed";
  openedAt: string;
  closedAt: string | null;
  reopenedAt: string | null;
  closedByNama: string | null;
  openingCash: number | null;
  closingCashCounted: number | null;
  closingCashExpected: number | null;
  selisih: number | null;
  catatan: string | null;
  ringkasan: {
    omzetCash: number;
    omzetTransfer: number;
    omzetQris: number;
    jumlahTransaksi: number;
    jumlahOrder: number;
    totalPengeluaran: number;
    jumlahPengeluaran: number;
    expected: number;
  };
  transaksiList: Array<{
    id: number;
    nomorNota: string;
    pelangganNama: string | null;
    total: number;
    metodeBayar: string;
    voided: boolean;
    createdAt: string;
  }>;
  pengeluaranList: Array<{
    id: number;
    kategori: string;
    deskripsi: string | null;
    jumlah: number;
    createdAt: string;
  }>;
};

export type PelangganDetail = {
  kind: "pelanggan";
  id: number;
  nama: string;
  telp: string | null;
  alamat: string | null;
  tipe: string;
  saldoLoyalti: number;
  stampGalon: number;
  totalEarn: number;
  totalRedeem: number;
  totalTransaksi: number; // jumlah transaksi non-void
  totalOmzet: number; // sum total transaksi non-void
  totalOrder: number; // jumlah order non-cancel
  piutangTotal: number; // sisa piutang effective
  piutangCount: number;
  galonDipinjam: number;
  galonTitipan: number;
  linkedUserName: string | null;
  hasAccount: boolean;
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
    pelangganId: o.pelangganId,
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
    pelangganId: t.pelangganId,
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

export async function getPelangganDetail(
  pelangganId: number,
): Promise<PelangganDetail | null> {
  await requireRole(["admin", "kasir"]);
  const p = await db.query.pelanggan.findFirst({
    where: eq(pelangganTable.id, pelangganId),
  });
  if (!p) return null;

  // Transaksi non-void
  const [trxAgg] = await db
    .select({
      jumlah: sql<number>`coalesce(count(*), 0)`,
      omzet: sql<number>`coalesce(sum(${transaksi.total}), 0)`,
    })
    .from(transaksi)
    .where(and(eq(transaksi.pelangganId, pelangganId), isNull(transaksi.voidedAt)));

  // Order non-cancel
  const [orderAgg] = await db
    .select({ jumlah: sql<number>`coalesce(count(*), 0)` })
    .from(orderHeader)
    .where(
      and(eq(orderHeader.pelangganId, pelangganId), ne(orderHeader.status, "batal")),
    );

  // Piutang
  const [piutangAgg] = await db
    .select({
      total: sql<number>`coalesce(sum(${orderHeader.totalEstimasi} - ${orderHeader.paidPartial}), 0)`,
      jumlah: sql<number>`coalesce(count(*), 0)`,
    })
    .from(orderHeader)
    .where(
      and(
        eq(orderHeader.pelangganId, pelangganId),
        eq(orderHeader.status, "selesai"),
        eq(orderHeader.statusBayar, "belum"),
      ),
    );

  // Earn / Redeem loyalty
  const [earnRow] = await db
    .select({ total: sql<number>`coalesce(sum(${mutasiLoyalti.jumlah}), 0)` })
    .from(mutasiLoyalti)
    .where(
      and(
        eq(mutasiLoyalti.pelangganId, pelangganId),
        sql`${mutasiLoyalti.jumlah} > 0`,
      ),
    );
  const [redeemRow] = await db
    .select({ total: sql<number>`coalesce(sum(${mutasiLoyalti.jumlah}), 0)` })
    .from(mutasiLoyalti)
    .where(
      and(
        eq(mutasiLoyalti.pelangganId, pelangganId),
        sql`${mutasiLoyalti.jumlah} < 0`,
      ),
    );

  // Galon dipinjam + titipan
  const [galonPinjamRow] = await db
    .select({ total: sql<number>`coalesce(sum(${galonDipinjam.jumlah}), 0)` })
    .from(galonDipinjam)
    .where(eq(galonDipinjam.pelangganId, pelangganId));
  const [titipanRow] = await db
    .select({ total: sql<number>`coalesce(sum(${galonPelanggan.jumlahDititip}), 0)` })
    .from(galonPelanggan)
    .where(eq(galonPelanggan.pelangganId, pelangganId));

  // Linked user
  const u = p.userId
    ? await db.query.user.findFirst({ where: eq(userTable.id, p.userId) })
    : null;

  return {
    kind: "pelanggan",
    id: p.id,
    nama: p.nama,
    telp: p.telp,
    alamat: p.alamat,
    tipe: p.tipe,
    saldoLoyalti: p.saldoLoyalti,
    stampGalon: p.stampGalon,
    totalEarn: Number(earnRow?.total ?? 0),
    totalRedeem: Math.abs(Number(redeemRow?.total ?? 0)),
    totalTransaksi: Number(trxAgg?.jumlah ?? 0),
    totalOmzet: Number(trxAgg?.omzet ?? 0),
    totalOrder: Number(orderAgg?.jumlah ?? 0),
    piutangTotal: Number(piutangAgg?.total ?? 0),
    piutangCount: Number(piutangAgg?.jumlah ?? 0),
    galonDipinjam: Number(galonPinjamRow?.total ?? 0),
    galonTitipan: Number(titipanRow?.total ?? 0),
    linkedUserName: u?.name ?? null,
    hasAccount: !!p.userId,
  };
}

export async function getShiftDetail(shiftId: number): Promise<ShiftDetail | null> {
  await requireRole(["admin", "kasir"]);
  const { ringkasanShift } = await import("./shift");

  const s = await db.query.shiftKasir.findFirst({
    where: eq(shiftKasir.id, shiftId),
  });
  if (!s) return null;

  const kasir = await db.query.user.findFirst({ where: eq(userTable.id, s.kasirUserId) });
  const closedByUser = s.closedByUserId
    ? await db.query.user.findFirst({ where: eq(userTable.id, s.closedByUserId) })
    : null;

  // Transaksi shift ini
  const trxList = await db
    .select({
      id: transaksi.id,
      nomorNota: transaksi.nomorNota,
      total: transaksi.total,
      metodeBayar: transaksi.metodeBayar,
      voidedAt: transaksi.voidedAt,
      createdAt: transaksi.createdAt,
      pelangganNama: pelangganTable.nama,
    })
    .from(transaksi)
    .leftJoin(pelangganTable, eq(transaksi.pelangganId, pelangganTable.id))
    .where(eq(transaksi.shiftId, shiftId))
    .orderBy(sql`${transaksi.createdAt} DESC`);

  // Pengeluaran shift ini
  const pengList = await db
    .select({
      id: pengeluaran.id,
      kategori: pengeluaran.kategori,
      deskripsi: pengeluaran.deskripsi,
      jumlah: pengeluaran.jumlah,
      createdAt: pengeluaran.createdAt,
    })
    .from(pengeluaran)
    .where(eq(pengeluaran.shiftId, shiftId))
    .orderBy(sql`${pengeluaran.createdAt} DESC`);

  const ring = await ringkasanShift(shiftId);

  return {
    kind: "shift",
    id: s.id,
    kasirNama: kasir?.name ?? "—",
    status: s.status,
    openedAt: s.openedAt.toISOString(),
    closedAt: s.closedAt?.toISOString() ?? null,
    reopenedAt: s.reopenedAt?.toISOString() ?? null,
    closedByNama:
      closedByUser && closedByUser.name !== kasir?.name ? closedByUser.name : null,
    openingCash: s.openingCash,
    closingCashCounted: s.closingCashCounted,
    closingCashExpected: s.closingCashExpected,
    selisih: s.selisih,
    catatan: s.catatan,
    ringkasan: {
      omzetCash: ring.omzetCash,
      omzetTransfer: ring.omzetTransfer,
      omzetQris: ring.omzetQris,
      jumlahTransaksi: ring.jumlahTransaksi,
      jumlahOrder: ring.jumlahOrder,
      totalPengeluaran: ring.totalPengeluaran,
      jumlahPengeluaran: ring.jumlahPengeluaran,
      expected: ring.expected,
    },
    transaksiList: trxList.map((t) => ({
      id: t.id,
      nomorNota: t.nomorNota,
      pelangganNama: t.pelangganNama,
      total: t.total,
      metodeBayar: t.metodeBayar,
      voided: !!t.voidedAt,
      createdAt: t.createdAt.toISOString(),
    })),
    pengeluaranList: pengList.map((p) => ({
      id: p.id,
      kategori: p.kategori,
      deskripsi: p.deskripsi,
      jumlah: p.jumlah,
      createdAt: p.createdAt.toISOString(),
    })),
  };
}
