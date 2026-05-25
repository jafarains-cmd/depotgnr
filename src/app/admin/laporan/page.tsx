import { sql, gte, lte, and, eq, desc, isNull, inArray } from "drizzle-orm";
import { db } from "@/db";
import { transaksi, transaksiItem } from "@/db/schema/transaksi";
import { orderHeader, orderItem } from "@/db/schema/order";
import { pelanggan as pelangganTable } from "@/db/schema/pelanggan";
import { produk } from "@/db/schema/produk";
import { pengeluaran } from "@/db/schema/pengeluaran";
import { PageHeader } from "@/components/AppShell";
import { formatRupiah } from "@/lib/utils";
import { parseRange } from "@/lib/date-range";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { ExportActions } from "./ExportActions";
import { LaporanNav } from "./LaporanNav";
import {
  DashboardCharts,
  type OmzetHarian,
  type GalonHarian,
  type MetodeBayar,
  type PelangganBaru,
  type OmzetVsPengeluaran,
} from "./DashboardCharts";

export const dynamic = "force-dynamic";

export default async function LaporanPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const range = parseRange(sp);
  const from = range.from;
  const to = range.to;

  const conds = [isNull(transaksi.voidedAt)];
  if (from) conds.push(gte(transaksi.createdAt, from));
  if (to) conds.push(lte(transaksi.createdAt, to));
  const where = and(...conds);

  const [ringkasan] = await db
    .select({
      totalOmzet: sql<number>`coalesce(sum(${transaksi.total}), 0)`,
      jumlahTransaksi: sql<number>`count(*)`,
    })
    .from(transaksi)
    .where(where);

  const pengeluaranConds = [];
  if (from) pengeluaranConds.push(gte(pengeluaran.tanggal, from));
  if (to) pengeluaranConds.push(lte(pengeluaran.tanggal, to));
  const wherePengeluaran = pengeluaranConds.length ? and(...pengeluaranConds) : undefined;
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
      produkId: transaksiItem.produkId,
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

  // Grafik harian: omzet per tanggal. createdAt mode 'timestamp' tersimpan sebagai
  // unix SECONDS di SQLite, jadi langsung pakai 'unixepoch' tanpa /1000.
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

  void harian; // used only for omzetHarianData merge below

  // ====== Data untuk Recharts interaktif ======

  // 1. Omzet harian gabungan: POS + Order lunas
  const orderConds = [eq(orderHeader.statusBayar, "lunas")];
  if (from) orderConds.push(gte(orderHeader.createdAt, from));
  if (to) orderConds.push(lte(orderHeader.createdAt, to));
  const whereOrder = and(...orderConds);

  const harianOrder = await db
    .select({
      tanggal: sql<string>`strftime('%Y-%m-%d', ${orderHeader.createdAt}, 'unixepoch', 'localtime')`,
      omzet: sql<number>`coalesce(sum(${orderHeader.totalEstimasi}), 0)`,
    })
    .from(orderHeader)
    .where(whereOrder)
    .groupBy(sql`strftime('%Y-%m-%d', ${orderHeader.createdAt}, 'unixepoch', 'localtime')`)
    .orderBy(sql`1`);

  const orderMap = new Map(harianOrder.map((h) => [h.tanggal, h.omzet]));
  const allDates = [
    ...new Set([...harian.map((h) => h.tanggal), ...harianOrder.map((h) => h.tanggal)]),
  ].sort();
  const posMap = new Map(harian.map((h) => [h.tanggal, h.omzet]));

  const omzetHarianData: OmzetHarian[] = allDates.map((tgl) => {
    const pos = posMap.get(tgl) ?? 0;
    const ord = orderMap.get(tgl) ?? 0;
    return { tanggal: tgl, omzetPOS: pos, omzetOrder: ord, total: pos + ord };
  });

  // 2. Galon per hari (POS items + order items)
  const galonPOS = await db
    .select({
      tanggal: sql<string>`strftime('%Y-%m-%d', ${transaksi.createdAt}, 'unixepoch', 'localtime')`,
      galon: sql<number>`coalesce(sum(${transaksiItem.qty}), 0)`,
    })
    .from(transaksiItem)
    .leftJoin(transaksi, eq(transaksiItem.transaksiId, transaksi.id))
    .where(where)
    .groupBy(sql`strftime('%Y-%m-%d', ${transaksi.createdAt}, 'unixepoch', 'localtime')`)
    .orderBy(sql`1`);

  const galonOrder = await db
    .select({
      tanggal: sql<string>`strftime('%Y-%m-%d', ${orderHeader.createdAt}, 'unixepoch', 'localtime')`,
      galon: sql<number>`coalesce(sum(${orderItem.qty}), 0)`,
    })
    .from(orderItem)
    .leftJoin(orderHeader, eq(orderItem.orderId, orderHeader.id))
    .where(whereOrder)
    .groupBy(sql`strftime('%Y-%m-%d', ${orderHeader.createdAt}, 'unixepoch', 'localtime')`)
    .orderBy(sql`1`);

  const galonPosMap = new Map(galonPOS.map((g) => [g.tanggal, g.galon]));
  const galonOrdMap = new Map(galonOrder.map((g) => [g.tanggal, g.galon]));
  const galonHarianData: GalonHarian[] = allDates.map((tgl) => ({
    tanggal: tgl,
    galon: (galonPosMap.get(tgl) ?? 0) + (galonOrdMap.get(tgl) ?? 0),
  }));

  // 3. Breakdown metode bayar (transaksi + order lunas)
  const metodePOS = await db
    .select({
      metode: transaksi.metodeBayar,
      jumlah: sql<number>`count(*)`,
      total: sql<number>`coalesce(sum(${transaksi.total}), 0)`,
    })
    .from(transaksi)
    .where(where)
    .groupBy(transaksi.metodeBayar);

  const metodeOrder = await db
    .select({
      metode: orderHeader.metodeBayar,
      jumlah: sql<number>`count(*)`,
      total: sql<number>`coalesce(sum(${orderHeader.totalEstimasi}), 0)`,
    })
    .from(orderHeader)
    .where(whereOrder)
    .groupBy(orderHeader.metodeBayar);

  const metodeMap = new Map<string, { jumlah: number; total: number }>();
  for (const m of [...metodePOS, ...metodeOrder]) {
    const key = (m.metode ?? "lainnya").toLowerCase();
    const existing = metodeMap.get(key);
    if (existing) {
      existing.jumlah += m.jumlah;
      existing.total += m.total;
    } else {
      metodeMap.set(key, { jumlah: m.jumlah, total: m.total });
    }
  }
  const metodeBayarData: MetodeBayar[] = [...metodeMap.entries()]
    .map(([metode, v]) => ({ metode, ...v }))
    .sort((a, b) => b.total - a.total);

  // 4. Pelanggan baru per minggu
  const pelangganBaruRaw = await db
    .select({
      minggu: sql<string>`strftime('%Y-W%W', ${pelangganTable.createdAt}, 'unixepoch', 'localtime')`,
      jumlah: sql<number>`count(*)`,
    })
    .from(pelangganTable)
    .where(
      from && to
        ? and(gte(pelangganTable.createdAt, from), lte(pelangganTable.createdAt, to))
        : undefined,
    )
    .groupBy(
      sql`strftime('%Y-W%W', ${pelangganTable.createdAt}, 'unixepoch', 'localtime')`,
    )
    .orderBy(sql`1`);

  const pelangganBaruData: PelangganBaru[] = pelangganBaruRaw.map((p) => ({
    periode: p.minggu,
    jumlah: p.jumlah,
  }));

  // 5. Omzet vs Pengeluaran harian
  const pengeluaranHarian = await db
    .select({
      tanggal: sql<string>`strftime('%Y-%m-%d', ${pengeluaran.tanggal}, 'unixepoch', 'localtime')`,
      total: sql<number>`coalesce(sum(${pengeluaran.jumlah}), 0)`,
    })
    .from(pengeluaran)
    .where(wherePengeluaran)
    .groupBy(
      sql`strftime('%Y-%m-%d', ${pengeluaran.tanggal}, 'unixepoch', 'localtime')`,
    )
    .orderBy(sql`1`);

  const pengeluaranMap = new Map(pengeluaranHarian.map((p) => [p.tanggal, p.total]));
  const allDatesVs = [
    ...new Set([...allDates, ...pengeluaranHarian.map((p) => p.tanggal)]),
  ].sort();
  const omzetVsPengeluaranData: OmzetVsPengeluaran[] = allDatesVs.map((tgl) => ({
    tanggal: tgl,
    omzet: (posMap.get(tgl) ?? 0) + (orderMap.get(tgl) ?? 0),
    pengeluaran: pengeluaranMap.get(tgl) ?? 0,
  }));

  const fromStr = from?.toISOString().slice(0, 10) ?? "";
  const toStr = to?.toISOString().slice(0, 10) ?? "";

  return (
    <div className="p-4 md:p-6 space-y-6 laporan-print">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .laporan-print { padding: 0 !important; }
          .laporan-print section, .laporan-print .rounded-2xl, .laporan-print .rounded-xl {
            box-shadow: none !important;
            border-color: #cbd5e1 !important;
            page-break-inside: avoid;
          }
          @page { margin: 12mm; size: A4; }
        }
        .laporan-print .print-only { display: none; }
        @media print { .laporan-print .print-only { display: block; } }
      `}</style>

      <div className="no-print">
        <PageHeader title="Laporan" description="Omzet, transaksi, dan breakdown produk." />
      </div>
      <LaporanNav active="/admin/laporan" />

      <div className="print-only text-center border-b border-line pb-3">
        <div className="text-xl font-extrabold">LAPORAN DEPOT AIR MINUM</div>
        <div className="text-sm mt-1">
          Periode: {new Date(fromStr).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })}
          {" — "}
          {new Date(toStr).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })}
        </div>
        <div className="text-[10px] text-[color:var(--muted)] mt-1">
          Dicetak: {new Date().toLocaleString("id-ID")}
        </div>
      </div>

      <div className="no-print">
        <DateRangeFilter
          active={range.key}
          customFrom={range.from}
          customTo={range.to}
          basePath="/admin/laporan"
        />
      </div>

      <ExportActions jenis="ringkasan" params={{ from: fromStr, to: toStr }} />

      <div className="grid sm:grid-cols-3 gap-3">
        <Card label="Total Omzet" value={formatRupiah(ringkasan.totalOmzet)} color="bg-emerald-50 text-emerald-700" />
        <Card
          label="Total Pengeluaran"
          value={formatRupiah(ringkasanPengeluaran.total)}
          color="bg-rose-50 text-rose-700"
        />
        <Card
          label="Profit Bersih"
          value={formatRupiah(ringkasan.totalOmzet - ringkasanPengeluaran.total)}
          color={
            ringkasan.totalOmzet - ringkasanPengeluaran.total >= 0
              ? "bg-brand-soft text-brand"
              : "bg-amber-50 text-amber-800"
          }
        />
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <Card label="Jumlah Transaksi" value={ringkasan.jumlahTransaksi.toString()} color="bg-blue-50 text-blue-700" />
        <Card
          label="Rata-rata / Transaksi"
          value={formatRupiah(ringkasan.jumlahTransaksi ? ringkasan.totalOmzet / ringkasan.jumlahTransaksi : 0)}
          color="bg-[color:var(--surface2)] text-ink"
        />
      </div>

      {breakdownPengeluaran.length > 0 && (
        <section className="bg-surface border border-line rounded-2xl p-4">
          <h2 className="font-semibold mb-3">Breakdown Pengeluaran per Kategori</h2>
          <div className="space-y-2">
            {breakdownPengeluaran.map((b) => {
              const pct = Math.round(
                (b.total / Math.max(1, ringkasanPengeluaran.total)) * 100,
              );
              return (
                <div key={b.kategori} className="flex items-center gap-3 text-xs">
                  <div className="w-28 capitalize truncate">{b.kategori.replace(/-/g, " ")}</div>
                  <div className="flex-1 h-5 bg-[color:var(--surface2)] rounded relative overflow-hidden">
                    <div
                      className="h-full bg-rose-400 rounded"
                      style={{ width: `${pct}%` }}
                    />
                    <div className="absolute inset-0 flex items-center justify-end pr-2 font-mono font-bold">
                      {pct}%
                    </div>
                  </div>
                  <div className="w-24 text-right font-mono font-bold whitespace-nowrap">
                    {formatRupiah(b.total)}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 5 grafik interaktif Recharts */}
      <DashboardCharts
        omzetHarian={omzetHarianData}
        galonHarian={galonHarianData}
        metodeBayar={metodeBayarData}
        pelangganBaru={pelangganBaruData}
        omzetVsPengeluaran={omzetVsPengeluaranData}
      />

      <section className="bg-surface border border-line rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-line font-semibold">Breakdown per Produk</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[color:var(--surface2)] text-[color:var(--muted)] text-left text-xs">
              <tr>
                <th className="p-3">Produk</th>
                <th className="p-3 hidden sm:table-cell">Jenis</th>
                <th className="p-3 text-right">Qty</th>
                <th className="p-3 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {breakdownProduk.map((b, i) => (
                <tr key={i}>
                  <td className="p-3 font-medium">
                    <div>{b.namaProduk ?? "-"}</div>
                    <div className="sm:hidden text-[10px] text-[color:var(--muted)] mt-0.5">
                      {b.jenis}
                    </div>
                  </td>
                  <td className="p-3 hidden sm:table-cell">{b.jenis}</td>
                  <td className="p-3 text-right">{b.totalQty}</td>
                  <td className="p-3 text-right font-medium whitespace-nowrap">
                    {formatRupiah(b.totalSubtotal)}
                  </td>
                </tr>
              ))}
              {breakdownProduk.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-[color:var(--muted)]">
                    Belum ada data.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="text-[10px] text-[color:var(--muted)] no-print">
        Tip: untuk simpan PDF, klik <b>Cetak / PDF</b> lalu pilih <i>Save as PDF</i> di dialog print browser.
        CSV bisa dibuka langsung di Excel / Google Sheets.
      </div>
    </div>
  );
}

function Card({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className={`rounded-xl p-5 border border-line ${color}`}>
      <div className="text-sm font-medium opacity-80">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}
