import { eq, desc, gte, lte, and, sql } from "drizzle-orm";
import { db } from "@/db";
import { pengeluaran } from "@/db/schema/pengeluaran";
import { user as userTable } from "@/db/schema/auth";
import { PageHeader } from "@/components/AppShell";
import { requireRole } from "@/lib/permissions";
import { formatRupiah } from "@/lib/utils";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { parseRange } from "@/lib/date-range";
import { PageSizeSelect } from "@/components/PageSizeSelect";
import { Pagination } from "@/components/Pagination";
import { parseLimit, parsePage, getPagination } from "@/lib/page-size";
import { PengeluaranClient } from "./PengeluaranClient";
import { KATEGORI_OPTIONS } from "./kategori";

export const dynamic = "force-dynamic";

export default async function PengeluaranPage({
  searchParams,
}: {
  searchParams: Promise<{
    range?: string;
    from?: string;
    to?: string;
    kategori?: string;
    limit?: string;
    page?: string;
  }>;
}) {
  await requireRole(["admin"]);
  const sp = await searchParams;
  const range = parseRange(sp);
  const limit = parseLimit(sp.limit);
  const pageParam = parsePage(sp.page);
  const kategoriFilter = sp.kategori?.trim().toLowerCase();

  const conds = [];
  if (range.from) conds.push(gte(pengeluaran.tanggal, range.from));
  if (range.to) conds.push(lte(pengeluaran.tanggal, range.to));
  if (kategoriFilter) conds.push(eq(pengeluaran.kategori, kategoriFilter));

  const whereClause = conds.length > 0 ? and(...conds) : undefined;

  const [aggRow] = await db
    .select({
      n: sql<number>`count(*)`,
      total: sql<number>`coalesce(sum(${pengeluaran.jumlah}), 0)`,
    })
    .from(pengeluaran)
    .where(whereClause);
  const total = aggRow?.n ?? 0;
  const totalPengeluaran = aggRow?.total ?? 0;
  const { page, totalPages, offset } = getPagination({ total, limit, page: pageParam });

  // Breakdown per kategori dalam filter
  const breakdown = await db
    .select({
      kategori: pengeluaran.kategori,
      total: sql<number>`coalesce(sum(${pengeluaran.jumlah}), 0)`,
    })
    .from(pengeluaran)
    .where(whereClause)
    .groupBy(pengeluaran.kategori)
    .orderBy(desc(sql<number>`sum(${pengeluaran.jumlah})`));

  const rows = await db
    .select({
      id: pengeluaran.id,
      tanggal: pengeluaran.tanggal,
      kategori: pengeluaran.kategori,
      jumlah: pengeluaran.jumlah,
      deskripsi: pengeluaran.deskripsi,
      fotoNotaUrl: pengeluaran.fotoNotaUrl,
      createdByName: userTable.name,
    })
    .from(pengeluaran)
    .leftJoin(userTable, eq(pengeluaran.createdBy, userTable.id))
    .where(whereClause)
    .orderBy(desc(pengeluaran.tanggal), desc(pengeluaran.id))
    .limit(limit)
    .offset(offset);

  return (
    <div className="p-4 md:p-6 max-w-5xl space-y-4">
      <PageHeader
        title="Pengeluaran Operasional"
        description="Track listrik, gaji, sparepart, filter, dll. Profit bersih = Omzet − Pengeluaran."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4">
          <div className="text-[10px] font-bold tracking-widest text-rose-700">
            TOTAL PENGELUARAN
          </div>
          <div className="text-2xl font-extrabold text-rose-900 mt-1">
            {formatRupiah(totalPengeluaran)}
          </div>
          <div className="text-[11px] text-rose-700 mt-1">{total} entri sesuai filter</div>
        </div>
        {breakdown.slice(0, 2).map((b) => (
          <div
            key={b.kategori}
            className="bg-surface border border-line rounded-2xl p-4"
          >
            <div className="text-[10px] font-bold tracking-widest text-[color:var(--muted)] uppercase">
              {b.kategori.replace(/-/g, " ")}
            </div>
            <div className="text-2xl font-extrabold text-ink mt-1">
              {formatRupiah(b.total)}
            </div>
            <div className="text-[11px] text-[color:var(--muted)] mt-1">
              {Math.round((b.total / Math.max(1, totalPengeluaran)) * 100)}% dari total
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <DateRangeFilter
          active={range.key}
          customFrom={range.from}
          customTo={range.to}
          basePath="/admin/pengeluaran"
        />
        <PageSizeSelect value={limit} />
      </div>

      <PengeluaranClient
        rows={rows.map((r) => ({
          id: r.id,
          tanggal: r.tanggal.toISOString(),
          kategori: r.kategori,
          jumlah: r.jumlah,
          deskripsi: r.deskripsi,
          fotoNotaUrl: r.fotoNotaUrl,
          createdByName: r.createdByName,
        }))}
        kategoriOptions={[...KATEGORI_OPTIONS]}
        kategoriFilter={kategoriFilter ?? null}
        breakdown={breakdown}
      />

      <Pagination page={page} totalPages={totalPages} total={total} />
    </div>
  );
}
