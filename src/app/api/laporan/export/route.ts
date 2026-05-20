import { NextResponse } from "next/server";
import { sql, gte, lte, and, eq, desc, isNull } from "drizzle-orm";
import { db } from "@/db";
import { transaksi, transaksiItem } from "@/db/schema/transaksi";
import { produk } from "@/db/schema/produk";
import { pengeluaran } from "@/db/schema/pengeluaran";
import { requireRole } from "@/lib/permissions";

function parseDate(s: string | null, fallback: Date): Date {
  if (!s) return fallback;
  const d = new Date(s);
  return isNaN(d.getTime()) ? fallback : d;
}

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n\r;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toRow(cells: unknown[]): string {
  return cells.map(csvEscape).join(",");
}

export async function GET(req: Request) {
  await requireRole(["admin"]);
  const url = new URL(req.url);
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const sevenDaysAgo = new Date(startOfToday);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

  const from = parseDate(url.searchParams.get("from"), sevenDaysAgo);
  const to = parseDate(
    url.searchParams.get("to"),
    new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59),
  );

  const where = and(
    gte(transaksi.createdAt, from),
    lte(transaksi.createdAt, to),
    isNull(transaksi.voidedAt),
  );
  const wherePengeluaran = and(gte(pengeluaran.tanggal, from), lte(pengeluaran.tanggal, to));

  const [ringkasan] = await db
    .select({
      totalOmzet: sql<number>`coalesce(sum(${transaksi.total}), 0)`,
      jumlahTransaksi: sql<number>`count(*)`,
    })
    .from(transaksi)
    .where(where);

  const [ringkasanPengeluaran] = await db
    .select({
      total: sql<number>`coalesce(sum(${pengeluaran.jumlah}), 0)`,
      jumlah: sql<number>`count(*)`,
    })
    .from(pengeluaran)
    .where(wherePengeluaran);

  const breakdownPengeluaran = await db
    .select({
      kategori: pengeluaran.kategori,
      total: sql<number>`coalesce(sum(${pengeluaran.jumlah}), 0)`,
    })
    .from(pengeluaran)
    .where(wherePengeluaran)
    .groupBy(pengeluaran.kategori)
    .orderBy(desc(sql<number>`sum(${pengeluaran.jumlah})`));

  const breakdownProduk = await db
    .select({
      namaProduk: produk.nama,
      jenis: transaksiItem.jenis,
      totalQty: sql<number>`coalesce(sum(${transaksiItem.qty}), 0)`,
      totalSubtotal: sql<number>`coalesce(sum(${transaksiItem.subtotal}), 0)`,
    })
    .from(transaksiItem)
    .leftJoin(produk, eq(transaksiItem.produkId, produk.id))
    .leftJoin(transaksi, eq(transaksiItem.transaksiId, transaksi.id))
    .where(where)
    .groupBy(transaksiItem.produkId, transaksiItem.jenis)
    .orderBy(desc(sql<number>`sum(${transaksiItem.subtotal})`));

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

  const fromStr = from.toISOString().slice(0, 10);
  const toStr = to.toISOString().slice(0, 10);
  const profit = ringkasan.totalOmzet - ringkasanPengeluaran.total;

  const lines: string[] = [];
  // BOM untuk Excel detect UTF-8
  // (string concat — bukan literal di file ini supaya tidak ambigu)
  lines.push(`LAPORAN DEPOT AIR MINUM`);
  lines.push(`Periode,${fromStr},sampai,${toStr}`);
  lines.push("");

  lines.push("RINGKASAN");
  lines.push(toRow(["Metrik", "Nilai"]));
  lines.push(toRow(["Total Omzet", ringkasan.totalOmzet]));
  lines.push(toRow(["Total Pengeluaran", ringkasanPengeluaran.total]));
  lines.push(toRow(["Profit Bersih", profit]));
  lines.push(toRow(["Jumlah Transaksi", ringkasan.jumlahTransaksi]));
  lines.push(
    toRow([
      "Rata-rata per Transaksi",
      ringkasan.jumlahTransaksi ? Math.round(ringkasan.totalOmzet / ringkasan.jumlahTransaksi) : 0,
    ]),
  );
  lines.push("");

  if (harian.length > 0) {
    lines.push("OMZET HARIAN");
    lines.push(toRow(["Tanggal", "Omzet", "Jumlah Transaksi"]));
    for (const h of harian) lines.push(toRow([h.tanggal, h.omzet, h.jml]));
    lines.push("");
  }

  if (breakdownProduk.length > 0) {
    lines.push("BREAKDOWN PER PRODUK");
    lines.push(toRow(["Produk", "Jenis", "Qty", "Subtotal"]));
    for (const b of breakdownProduk) {
      lines.push(toRow([b.namaProduk ?? "-", b.jenis, b.totalQty, b.totalSubtotal]));
    }
    lines.push("");
  }

  if (breakdownPengeluaran.length > 0) {
    lines.push("BREAKDOWN PENGELUARAN PER KATEGORI");
    lines.push(toRow(["Kategori", "Total"]));
    for (const b of breakdownPengeluaran) {
      lines.push(toRow([b.kategori.replace(/-/g, " "), b.total]));
    }
    lines.push("");
  }

  const csv = "﻿" + lines.join("\r\n");
  const filename = `laporan_${fromStr}_${toStr}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
