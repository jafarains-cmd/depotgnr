import { desc, eq, asc } from "drizzle-orm";
import { Package, Truck, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { db } from "@/db";
import {
  pembelianGalon,
  supplier as supplierTable,
} from "@/db/schema/pembelian";
import { produk } from "@/db/schema/produk";
import { user as userTable } from "@/db/schema/auth";
import { requireRole } from "@/lib/permissions";
import { PageHeader } from "@/components/AppShell";
import { formatRupiah } from "@/lib/utils";
import { parseRange } from "@/lib/date-range";
import { parseLimit, parsePage, getPagination } from "@/lib/page-size";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { PageSizeSelect } from "@/components/PageSizeSelect";
import { Pagination } from "@/components/Pagination";
import { PembelianClient } from "./PembelianClient";
import { and, gte, lte } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function PembelianGalonPage({
  searchParams,
}: {
  searchParams: Promise<{
    range?: string;
    from?: string;
    to?: string;
    limit?: string;
    page?: string;
  }>;
}) {
  await requireRole(["admin"]);
  const sp = await searchParams;
  const range = parseRange(sp);
  const limit = parseLimit(sp.limit);
  const pageParam = parsePage(sp.page);

  const conds = [];
  if (range.from) conds.push(gte(pembelianGalon.tanggal, range.from));
  if (range.to) conds.push(lte(pembelianGalon.tanggal, range.to));
  const where = conds.length > 0 ? and(...conds) : undefined;

  const [produkList, supplierList, rows, totalCount, summary] = await Promise.all([
    db
      .select({
        id: produk.id,
        nama: produk.nama,
        brand: produk.brand,
        hargaPokok: produk.hargaPokok,
      })
      .from(produk)
      .where(eq(produk.aktif, true))
      .orderBy(asc(produk.nama)),
    db
      .select()
      .from(supplierTable)
      .where(eq(supplierTable.aktif, true))
      .orderBy(asc(supplierTable.nama)),
    db
      .select({
        id: pembelianGalon.id,
        tanggal: pembelianGalon.tanggal,
        produkNama: produk.nama,
        produkBrand: produk.brand,
        supplierNama: supplierTable.nama,
        jenis: pembelianGalon.jenis,
        jumlah: pembelianGalon.jumlah,
        hargaSatuan: pembelianGalon.hargaSatuan,
        totalHarga: pembelianGalon.totalHarga,
        noInvoice: pembelianGalon.noInvoice,
        fotoNotaUrl: pembelianGalon.fotoNotaUrl,
        catatan: pembelianGalon.catatan,
        createdByNama: userTable.name,
      })
      .from(pembelianGalon)
      .leftJoin(produk, eq(pembelianGalon.produkId, produk.id))
      .leftJoin(supplierTable, eq(pembelianGalon.supplierId, supplierTable.id))
      .leftJoin(userTable, eq(pembelianGalon.createdBy, userTable.id))
      .where(where)
      .orderBy(desc(pembelianGalon.tanggal))
      .limit(limit)
      .offset((pageParam - 1) * limit),
    db
      .select({ n: pembelianGalon.id })
      .from(pembelianGalon)
      .where(where)
      .then((rs) => rs.length),
    db
      .select({
        jumlahKosong: pembelianGalon.jumlah,
        jumlahTerisi: pembelianGalon.jumlah,
        totalHarga: pembelianGalon.totalHarga,
        jenis: pembelianGalon.jenis,
      })
      .from(pembelianGalon)
      .where(where),
  ]);

  const { page, totalPages } = getPagination({
    total: totalCount,
    limit,
    page: pageParam,
  });

  const totalKosong = summary
    .filter((r) => r.jenis === "kosong")
    .reduce((s, r) => s + r.jumlahKosong, 0);
  const totalTerisi = summary
    .filter((r) => r.jenis === "terisi")
    .reduce((s, r) => s + r.jumlahTerisi, 0);
  const totalNilai = summary.reduce((s, r) => s + r.totalHarga, 0);

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-5xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Link
            href="/admin/inventory"
            className="text-xs text-brand hover:underline inline-flex items-center gap-1 mb-1"
          >
            <ArrowLeft size={12} /> Kembali ke Inventory
          </Link>
          <PageHeader
            title="Pembelian Galon"
            description="Catat pembelian galon dari supplier — auto update stok + pengeluaran."
          />
        </div>
        <PembelianClient produkList={produkList} supplierList={supplierList} />
      </div>

      <DateRangeFilter
        active={range.key}
        customFrom={range.from}
        customTo={range.to}
        basePath="/admin/inventory/pembelian"
      />

      <div className="grid sm:grid-cols-3 gap-3">
        <SumCard
          label="Total Galon Kosong Dibeli"
          value={`${totalKosong} galon`}
          icon={<Package size={16} />}
          color="sky"
        />
        <SumCard
          label="Total Galon Terisi Dibeli"
          value={`${totalTerisi} galon`}
          icon={<Truck size={16} />}
          color="emerald"
        />
        <SumCard
          label="Total Nilai Pembelian"
          value={formatRupiah(totalNilai)}
          icon={<Package size={16} />}
          color="amber"
          highlight
        />
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap text-sm">
        <span className="text-[color:var(--muted)]">{totalCount} pembelian</span>
        <PageSizeSelect value={limit} />
      </div>

      <div className="bg-surface border border-line rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-[color:var(--surface2)] text-[color:var(--muted)] text-left">
              <tr>
                <th className="p-3">Tanggal</th>
                <th className="p-3">Produk</th>
                <th className="p-3">Jenis</th>
                <th className="p-3">Supplier</th>
                <th className="p-3 text-right">Qty</th>
                <th className="p-3 text-right">Harga/gln</th>
                <th className="p-3 text-right">Total</th>
                <th className="p-3">Invoice</th>
                <th className="p-3">Foto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-[color:var(--muted)]">
                    Belum ada pembelian pada periode ini. Klik &quot;Beli Galon&quot; untuk mulai.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="p-3 whitespace-nowrap">
                    {r.tanggal.toLocaleDateString("id-ID", {
                      day: "2-digit",
                      month: "short",
                      year: "2-digit",
                    })}
                  </td>
                  <td className="p-3">
                    <div className="font-bold">{r.produkNama ?? "—"}</div>
                    {r.produkBrand && (
                      <div className="text-[10px] text-[color:var(--muted)]">
                        {r.produkBrand}
                      </div>
                    )}
                  </td>
                  <td className="p-3">
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                        r.jenis === "kosong"
                          ? "bg-sky-100 text-sky-700"
                          : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {r.jenis === "kosong" ? "KOSONG" : "TERISI"}
                    </span>
                  </td>
                  <td className="p-3">{r.supplierNama ?? "—"}</td>
                  <td className="p-3 text-right font-mono font-bold">
                    {r.jumlah}
                  </td>
                  <td className="p-3 text-right">{formatRupiah(r.hargaSatuan)}</td>
                  <td className="p-3 text-right font-bold text-brand">
                    {formatRupiah(r.totalHarga)}
                  </td>
                  <td className="p-3 font-mono text-[10px]">
                    {r.noInvoice ?? "—"}
                  </td>
                  <td className="p-3">
                    {r.fotoNotaUrl ? (
                      <a
                        href={r.fotoNotaUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand hover:underline text-[10px]"
                      >
                        Lihat →
                      </a>
                    ) : (
                      <span className="text-[color:var(--muted)] text-[10px]">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination page={page} totalPages={totalPages} total={totalCount} />
    </div>
  );
}

function SumCard({
  label,
  value,
  icon,
  color,
  highlight,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: "sky" | "emerald" | "amber";
  highlight?: boolean;
}) {
  const bg = highlight
    ? color === "amber"
      ? "bg-amber-50 border-amber-200"
      : color === "sky"
        ? "bg-sky-50 border-sky-200"
        : "bg-emerald-50 border-emerald-200"
    : "bg-surface border-line";
  const textColor = highlight
    ? color === "amber"
      ? "text-amber-700"
      : color === "sky"
        ? "text-sky-700"
        : "text-emerald-700"
    : "";
  return (
    <div className={`rounded-xl border px-3 py-2 ${bg}`}>
      <div className="text-[10px] tracking-widest font-bold text-[color:var(--muted)] inline-flex items-center gap-1">
        {icon} {label}
      </div>
      <div className={`text-base font-extrabold mt-0.5 ${textColor}`}>{value}</div>
    </div>
  );
}
