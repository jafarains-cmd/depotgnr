import { NextResponse } from "next/server";
import { sql, gte, lte, and, eq, desc, isNull, like, or, inArray } from "drizzle-orm";
import { db } from "@/db";
import { transaksi, transaksiItem } from "@/db/schema/transaksi";
import { produk } from "@/db/schema/produk";
import { pengeluaran } from "@/db/schema/pengeluaran";
import { orderHeader, orderItem } from "@/db/schema/order";
import { user as userTable } from "@/db/schema/auth";
import { pelanggan as pelangganTable } from "@/db/schema/pelanggan";
import { bonusKurir } from "@/db/schema/bonus";
import { parseRange } from "@/lib/date-range";
import { requireRole } from "@/lib/permissions";

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n\r;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
function toRow(cells: unknown[]): string {
  return cells.map(csvEscape).join(",");
}
function fmtTanggal(d: Date | null | undefined): string {
  if (!d) return "";
  return d.toISOString().slice(0, 16).replace("T", " ");
}

export async function GET(req: Request) {
  await requireRole(["admin"]);
  const url = new URL(req.url);
  const sp = Object.fromEntries(url.searchParams.entries());
  const jenis = sp.jenis ?? "ringkasan";

  const range = parseRange(sp);
  const from = range.from;
  const to = range.to;
  const fromStr = from?.toISOString().slice(0, 10) ?? "";
  const toStr = to?.toISOString().slice(0, 10) ?? "";

  const lines: string[] = [];
  const titleMap: Record<string, string> = {
    ringkasan: "LAPORAN RINGKASAN",
    penjualan: "LAPORAN PENJUALAN",
    "order-antar": "LAPORAN ORDER ANTAR",
    pengeluaran: "LAPORAN PENGELUARAN",
    "bonus-kurir": "LAPORAN BONUS KURIR",
  };

  lines.push(titleMap[jenis] ?? "LAPORAN");
  lines.push(`Periode,${fromStr},sampai,${toStr}`);
  lines.push(`Dicetak,${new Date().toISOString().slice(0, 16).replace("T", " ")}`);
  lines.push("");

  const filename = `${jenis}_${fromStr}_${toStr}.csv`;

  if (jenis === "penjualan") {
    await writePenjualan(lines, { from, to, sp });
  } else if (jenis === "order-antar") {
    await writeOrderAntar(lines, { from, to, sp });
  } else if (jenis === "pengeluaran") {
    await writePengeluaran(lines, { from, to, sp });
  } else if (jenis === "bonus-kurir") {
    await writeBonusKurir(lines, { from, to, sp });
  } else {
    await writeRingkasan(lines, { from, to });
  }

  const csv = "﻿" + lines.join("\r\n");
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

// -----------------------------------------------------------------------------
type Ctx = { from: Date | null; to: Date | null; sp: Record<string, string> };

async function writeRingkasan(lines: string[], ctx: Pick<Ctx, "from" | "to">) {
  const { from, to } = ctx;
  const where = and(
    from ? gte(transaksi.createdAt, from) : undefined,
    to ? lte(transaksi.createdAt, to) : undefined,
    isNull(transaksi.voidedAt),
  );
  const wherePengeluaran = and(
    from ? gte(pengeluaran.tanggal, from) : undefined,
    to ? lte(pengeluaran.tanggal, to) : undefined,
  );

  const [r1] = await db
    .select({
      omzet: sql<number>`coalesce(sum(${transaksi.total}), 0)`,
      n: sql<number>`count(*)`,
    })
    .from(transaksi)
    .where(where);
  const [r2] = await db
    .select({ total: sql<number>`coalesce(sum(${pengeluaran.jumlah}), 0)` })
    .from(pengeluaran)
    .where(wherePengeluaran);

  lines.push("RINGKASAN");
  lines.push(toRow(["Metrik", "Nilai"]));
  lines.push(toRow(["Total Omzet", r1.omzet]));
  lines.push(toRow(["Total Pengeluaran", r2.total]));
  lines.push(toRow(["Profit Bersih", r1.omzet - r2.total]));
  lines.push(toRow(["Jumlah Transaksi", r1.n]));
  lines.push("");

  const harian = await db
    .select({
      tanggal: sql<string>`strftime('%Y-%m-%d', ${transaksi.createdAt}, 'unixepoch', 'localtime')`,
      omzet: sql<number>`coalesce(sum(${transaksi.total}), 0)`,
      jml: sql<number>`count(*)`,
    })
    .from(transaksi)
    .where(where)
    .groupBy(sql`strftime('%Y-%m-%d', ${transaksi.createdAt}, 'unixepoch', 'localtime')`)
    .orderBy(sql`1`);
  if (harian.length) {
    lines.push("OMZET HARIAN");
    lines.push(toRow(["Tanggal", "Omzet", "Transaksi"]));
    for (const h of harian) lines.push(toRow([h.tanggal, h.omzet, h.jml]));
  }
}

async function writePenjualan(lines: string[], ctx: Ctx) {
  const { from, to, sp } = ctx;
  const conds = [isNull(transaksi.voidedAt)];
  if (from) conds.push(gte(transaksi.createdAt, from));
  if (to) conds.push(lte(transaksi.createdAt, to));
  if (sp.userId) conds.push(eq(transaksi.kasirUserId, sp.userId));
  if (sp.pelangganId) conds.push(eq(transaksi.pelangganId, Number(sp.pelangganId)));
  if (sp.q) {
    const pat = `%${sp.q}%`;
    conds.push(
      or(
        like(transaksi.nomorNota, pat),
        like(pelangganTable.nama, pat),
        like(transaksi.catatan, pat),
      )!,
    );
  }
  const where = and(...conds);

  const rows = await db
    .select({
      id: transaksi.id,
      nomorNota: transaksi.nomorNota,
      createdAt: transaksi.createdAt,
      subtotal: transaksi.subtotal,
      diskon: transaksi.diskon,
      total: transaksi.total,
      metodeBayar: transaksi.metodeBayar,
      status: transaksi.status,
      kasirNama: userTable.name,
      pelangganNama: pelangganTable.nama,
    })
    .from(transaksi)
    .leftJoin(userTable, eq(transaksi.kasirUserId, userTable.id))
    .leftJoin(pelangganTable, eq(transaksi.pelangganId, pelangganTable.id))
    .where(where)
    .orderBy(desc(transaksi.createdAt));

  const ids = rows.map((r) => r.id);
  const itemMap = new Map<number, string>();
  if (ids.length) {
    const items = await db
      .select({
        transaksiId: transaksiItem.transaksiId,
        qty: transaksiItem.qty,
        jenis: transaksiItem.jenis,
        nama: produk.nama,
      })
      .from(transaksiItem)
      .leftJoin(produk, eq(transaksiItem.produkId, produk.id))
      .where(inArray(transaksiItem.transaksiId, ids));
    const tmp = new Map<number, string[]>();
    for (const it of items) {
      const arr = tmp.get(it.transaksiId) ?? [];
      arr.push(`${it.nama ?? "-"} (${it.qty} ${it.jenis})`);
      tmp.set(it.transaksiId, arr);
    }
    for (const [k, v] of tmp) itemMap.set(k, v.join("; "));
  }

  lines.push("DETAIL TRANSAKSI");
  lines.push(
    toRow([
      "Tanggal",
      "No. Nota",
      "Kasir",
      "Pelanggan",
      "Items",
      "Subtotal",
      "Diskon",
      "Total",
      "Metode Bayar",
      "Status",
    ]),
  );
  let totalAll = 0;
  for (const r of rows) {
    totalAll += r.total;
    lines.push(
      toRow([
        fmtTanggal(r.createdAt),
        r.nomorNota,
        r.kasirNama ?? "",
        r.pelangganNama ?? "",
        itemMap.get(r.id) ?? "",
        r.subtotal,
        r.diskon,
        r.total,
        r.metodeBayar,
        r.status,
      ]),
    );
  }
  lines.push(toRow(["", "", "", "", "", "", "TOTAL", totalAll, "", ""]));
}

async function writeOrderAntar(lines: string[], ctx: Ctx) {
  const { from, to, sp } = ctx;
  const conds = [];
  if (from) conds.push(gte(orderHeader.createdAt, from));
  if (to) conds.push(lte(orderHeader.createdAt, to));
  if (sp.userId) conds.push(eq(orderHeader.kurirUserId, sp.userId));
  if (sp.pelangganId) conds.push(eq(orderHeader.pelangganId, Number(sp.pelangganId)));
  if (sp.status && sp.status !== "all") {
    conds.push(eq(orderHeader.status, sp.status as "pending"));
  }
  if (sp.q) {
    const pat = `%${sp.q}%`;
    conds.push(
      or(
        like(orderHeader.nomorOrder, pat),
        like(pelangganTable.nama, pat),
        like(orderHeader.alamatAntar, pat),
      )!,
    );
  }
  const where = conds.length ? and(...conds) : undefined;

  const rows = await db
    .select({
      id: orderHeader.id,
      nomorOrder: orderHeader.nomorOrder,
      createdAt: orderHeader.createdAt,
      diantarAt: orderHeader.diantarAt,
      status: orderHeader.status,
      statusBayar: orderHeader.statusBayar,
      alamatAntar: orderHeader.alamatAntar,
      totalEstimasi: orderHeader.totalEstimasi,
      metodeBayar: orderHeader.metodeBayar,
      kurirNama: userTable.name,
      pelangganNama: pelangganTable.nama,
      pelangganTelp: pelangganTable.telp,
    })
    .from(orderHeader)
    .leftJoin(userTable, eq(orderHeader.kurirUserId, userTable.id))
    .leftJoin(pelangganTable, eq(orderHeader.pelangganId, pelangganTable.id))
    .where(where)
    .orderBy(desc(orderHeader.createdAt));

  const ids = rows.map((r) => r.id);
  const galonMap = new Map<number, number>();
  if (ids.length) {
    const items = await db
      .select({ orderId: orderItem.orderId, qty: orderItem.qty })
      .from(orderItem)
      .where(inArray(orderItem.orderId, ids));
    for (const it of items) galonMap.set(it.orderId, (galonMap.get(it.orderId) ?? 0) + it.qty);
  }

  lines.push("DETAIL ORDER ANTAR");
  lines.push(
    toRow([
      "Tanggal",
      "No. Order",
      "Status",
      "Kurir",
      "Pelanggan",
      "Telp",
      "Alamat",
      "Galon",
      "Metode Bayar",
      "Status Bayar",
      "Total",
      "Antar pada",
    ]),
  );
  let totalAll = 0;
  for (const r of rows) {
    totalAll += r.totalEstimasi;
    lines.push(
      toRow([
        fmtTanggal(r.createdAt),
        r.nomorOrder,
        r.status,
        r.kurirNama ?? "",
        r.pelangganNama ?? "",
        r.pelangganTelp ?? "",
        r.alamatAntar ?? "",
        galonMap.get(r.id) ?? 0,
        r.metodeBayar ?? "",
        r.statusBayar,
        r.totalEstimasi,
        fmtTanggal(r.diantarAt),
      ]),
    );
  }
  lines.push(toRow(["", "", "", "", "", "", "", "", "", "TOTAL", totalAll, ""]));
}

async function writePengeluaran(lines: string[], ctx: Ctx) {
  const { from, to, sp } = ctx;
  const conds = [];
  if (from) conds.push(gte(pengeluaran.tanggal, from));
  if (to) conds.push(lte(pengeluaran.tanggal, to));
  if (sp.userId) conds.push(eq(pengeluaran.createdBy, sp.userId));
  if (sp.kategori && sp.kategori !== "all") conds.push(eq(pengeluaran.kategori, sp.kategori));
  if (sp.q) {
    const pat = `%${sp.q}%`;
    conds.push(or(like(pengeluaran.deskripsi, pat), like(pengeluaran.kategori, pat))!);
  }
  const where = conds.length ? and(...conds) : undefined;

  const rows = await db
    .select({
      id: pengeluaran.id,
      tanggal: pengeluaran.tanggal,
      kategori: pengeluaran.kategori,
      jumlah: pengeluaran.jumlah,
      deskripsi: pengeluaran.deskripsi,
      createdByName: userTable.name,
    })
    .from(pengeluaran)
    .leftJoin(userTable, eq(pengeluaran.createdBy, userTable.id))
    .where(where)
    .orderBy(desc(pengeluaran.tanggal));

  lines.push("DETAIL PENGELUARAN");
  lines.push(toRow(["Tanggal", "Kategori", "Deskripsi", "Dicatat oleh", "Jumlah"]));
  let totalAll = 0;
  for (const r of rows) {
    totalAll += r.jumlah;
    lines.push(
      toRow([
        r.tanggal.toISOString().slice(0, 10),
        r.kategori.replace(/-/g, " "),
        r.deskripsi ?? "",
        r.createdByName ?? "",
        r.jumlah,
      ]),
    );
  }
  lines.push(toRow(["", "", "", "TOTAL", totalAll]));
}

async function writeBonusKurir(lines: string[], ctx: Ctx) {
  const { from, to, sp } = ctx;
  const conds = [];
  if (from) conds.push(gte(bonusKurir.createdAt, from));
  if (to) conds.push(lte(bonusKurir.createdAt, to));
  if (sp.userId) conds.push(eq(bonusKurir.kurirUserId, sp.userId));
  if (sp.status && sp.status !== "all") {
    conds.push(eq(bonusKurir.status, sp.status as "pending"));
  }
  const where = conds.length ? and(...conds) : undefined;

  const rows = await db
    .select({
      id: bonusKurir.id,
      orderId: bonusKurir.orderId,
      jumlahGalon: bonusKurir.jumlahGalon,
      ratePerGalon: bonusKurir.ratePerGalon,
      total: bonusKurir.total,
      status: bonusKurir.status,
      paidAt: bonusKurir.paidAt,
      createdAt: bonusKurir.createdAt,
      kurirNama: userTable.name,
      nomorOrder: orderHeader.nomorOrder,
      pelangganNama: pelangganTable.nama,
    })
    .from(bonusKurir)
    .leftJoin(userTable, eq(bonusKurir.kurirUserId, userTable.id))
    .leftJoin(orderHeader, eq(bonusKurir.orderId, orderHeader.id))
    .leftJoin(pelangganTable, eq(orderHeader.pelangganId, pelangganTable.id))
    .where(where)
    .orderBy(desc(bonusKurir.createdAt));

  lines.push("DETAIL BONUS KURIR");
  lines.push(
    toRow([
      "Tanggal",
      "No. Order",
      "Kurir",
      "Pelanggan",
      "Galon",
      "Rate",
      "Total Bonus",
      "Status",
      "Dibayar pada",
    ]),
  );
  let totalAll = 0;
  for (const r of rows) {
    totalAll += r.total;
    lines.push(
      toRow([
        r.createdAt.toISOString().slice(0, 10),
        r.nomorOrder ?? `#${r.orderId}`,
        r.kurirNama ?? "",
        r.pelangganNama ?? "",
        r.jumlahGalon,
        r.ratePerGalon,
        r.total,
        r.status,
        r.paidAt ? r.paidAt.toISOString().slice(0, 10) : "",
      ]),
    );
  }
  lines.push(toRow(["", "", "", "", "", "TOTAL", totalAll, "", ""]));
}
