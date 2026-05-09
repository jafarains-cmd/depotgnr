import { sql, gte, lte, and, eq, desc, isNull } from "drizzle-orm";
import { db } from "@/db";
import { transaksi, transaksiItem } from "@/db/schema/transaksi";
import { produk } from "@/db/schema/produk";
import { pengeluaran } from "@/db/schema/pengeluaran";
import { PageHeader } from "@/components/AppShell";
import { formatRupiah } from "@/lib/utils";

export const dynamic = "force-dynamic";

function parseDate(s: string | undefined, fallback: Date): Date {
  if (!s) return fallback;
  const d = new Date(s);
  return isNaN(d.getTime()) ? fallback : d;
}

export default async function LaporanPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const sp = await searchParams;

  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const sevenDaysAgo = new Date(startOfToday);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

  const from = parseDate(sp.from, sevenDaysAgo);
  const to = parseDate(sp.to, new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59));

  const where = and(
    gte(transaksi.createdAt, from),
    lte(transaksi.createdAt, to),
    isNull(transaksi.voidedAt),
  );

  const [ringkasan] = await db
    .select({
      totalOmzet: sql<number>`coalesce(sum(${transaksi.total}), 0)`,
      jumlahTransaksi: sql<number>`count(*)`,
    })
    .from(transaksi)
    .where(where);

  // Pengeluaran dalam range yang sama
  const wherePengeluaran = and(
    gte(pengeluaran.tanggal, from),
    lte(pengeluaran.tanggal, to),
  );
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

  const maxOmzet = Math.max(...harian.map((h) => h.omzet), 1);

  const fromStr = from.toISOString().slice(0, 10);
  const toStr = to.toISOString().slice(0, 10);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader title="Laporan" description="Omzet, transaksi, dan breakdown produk." />

      <form className="bg-surface border border-line rounded-2xl p-4 flex gap-3 items-end text-sm flex-wrap">
        <div className="flex-1 min-w-[140px]">
          <label className="block text-xs text-[color:var(--muted)] mb-1">Dari</label>
          <input
            type="date"
            name="from"
            defaultValue={fromStr}
            className="w-full px-3 py-1.5 border border-line rounded-md"
          />
        </div>
        <div className="flex-1 min-w-[140px]">
          <label className="block text-xs text-[color:var(--muted)] mb-1">Sampai</label>
          <input
            type="date"
            name="to"
            defaultValue={toStr}
            className="w-full px-3 py-1.5 border border-line rounded-md"
          />
        </div>
        <button className="px-4 py-1.5 bg-brand text-white rounded-md whitespace-nowrap">
          Terapkan
        </button>
      </form>

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

      <section className="bg-surface border border-line rounded-2xl p-4">
        <h2 className="font-semibold mb-3">Omzet Harian</h2>
        {harian.length === 0 ? (
          <div className="text-sm text-[color:var(--muted)] p-4 text-center">Belum ada data.</div>
        ) : (
          <div className="space-y-1.5">
            {harian.map((h) => (
              <div key={h.tanggal} className="flex items-center gap-2 sm:gap-3 text-xs">
                <div className="w-16 sm:w-24 text-[color:var(--muted)] truncate">
                  {new Date(h.tanggal).toLocaleDateString("id-ID", {
                    day: "2-digit",
                    month: "short",
                  })}
                </div>
                <div className="flex-1 bg-[color:var(--surface2)] rounded h-6 relative overflow-hidden min-w-0">
                  <div
                    className="bg-brand h-full"
                    style={{ width: `${(h.omzet / maxOmzet) * 100}%` }}
                  />
                </div>
                <div className="w-20 sm:w-32 text-right font-medium whitespace-nowrap">
                  {formatRupiah(h.omzet)}
                </div>
                <div className="w-8 sm:w-12 text-right text-[color:var(--muted)]">
                  {h.jml}×
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

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

      <div className="text-xs text-[color:var(--muted)]">
        Push laporan ke Google Sheets tersedia di milestone Sheets sync (M11).
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
