import { eq, desc, ne, and, gte, lte, sql, like, or } from "drizzle-orm";
import { db } from "@/db";
import { orderHeader } from "@/db/schema/order";
import { pelanggan as pelangganTable } from "@/db/schema/pelanggan";
import { requireRole } from "@/lib/permissions";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { parseRange } from "@/lib/date-range";
import { PembayaranClient, type Row } from "./PembayaranClient";
import { PageSizeSelect } from "@/components/PageSizeSelect";
import { Pagination } from "@/components/Pagination";
import { parseLimit, parsePage, getPagination } from "@/lib/page-size";

export const dynamic = "force-dynamic";

export default async function PembayaranPage({
  searchParams,
}: {
  searchParams: Promise<{
    range?: string;
    from?: string;
    to?: string;
    limit?: string;
    page?: string;
    q?: string;
  }>;
}) {
  await requireRole(["admin", "kasir"]);
  const sp = await searchParams;
  const range = parseRange(sp);
  const limit = parseLimit(sp.limit);
  const pageParam = parsePage(sp.page);
  const q = (sp.q ?? "").trim();

  // Filter ke SQL supaya pagination akurat: status != batal, dan
  // (statusBayar in [menunggu, lunas] OR (status=selesai AND statusBayar=belum))
  const conds = [
    ne(orderHeader.status, "batal"),
    sql`(${orderHeader.statusBayar} = 'menunggu' OR ${orderHeader.statusBayar} = 'lunas' OR (${orderHeader.status} = 'selesai' AND ${orderHeader.statusBayar} = 'belum'))`,
  ];
  if (range.from) conds.push(gte(orderHeader.createdAt, range.from));
  if (range.to) conds.push(lte(orderHeader.createdAt, range.to));
  if (q) {
    const pat = `%${q}%`;
    conds.push(
      or(
        like(orderHeader.nomorOrder, pat),
        like(pelangganTable.nama, pat),
        like(pelangganTable.telp, pat),
      )!,
    );
  }

  const whereClause = and(...conds);
  const [countRow] = await db
    .select({ n: sql<number>`count(*)` })
    .from(orderHeader)
    .leftJoin(pelangganTable, eq(orderHeader.pelangganId, pelangganTable.id))
    .where(whereClause);
  const total = countRow?.n ?? 0;
  const { page, totalPages, offset } = getPagination({ total, limit, page: pageParam });

  const list = await db
    .select({
      id: orderHeader.id,
      nomorOrder: orderHeader.nomorOrder,
      totalEstimasi: orderHeader.totalEstimasi,
      metodeBayar: orderHeader.metodeBayar,
      statusBayar: orderHeader.statusBayar,
      statusOrder: orderHeader.status,
      buktiBayarUrl: orderHeader.buktiBayarUrl,
      bayarAt: orderHeader.bayarAt,
      diantarAt: orderHeader.diantarAt,
      createdAt: orderHeader.createdAt,
      pelangganNama: pelangganTable.nama,
      pelangganTelp: pelangganTable.telp,
    })
    .from(orderHeader)
    .leftJoin(pelangganTable, eq(orderHeader.pelangganId, pelangganTable.id))
    .where(whereClause)
    .orderBy(desc(orderHeader.updatedAt))
    .limit(limit)
    .offset(offset);

  const rows: Row[] = list.map((r) => ({
    id: r.id,
    nomorOrder: r.nomorOrder,
    total: r.totalEstimasi,
    metode: r.metodeBayar,
    status: r.statusBayar,
    statusOrder: r.statusOrder,
    buktiUrl: r.buktiBayarUrl,
    bayarAt: r.bayarAt?.toISOString() ?? null,
    diantarAt: r.diantarAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    pelangganNama: r.pelangganNama,
    pelangganTelp: r.pelangganTelp,
  }));

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-xl font-bold">Konfirmasi Pembayaran</h1>
        <p className="text-sm text-[color:var(--muted)]">
          Review bukti pembayaran, tandai lunas piutang, atau lihat history.
        </p>
      </div>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <DateRangeFilter
          active={range.key}
          customFrom={range.from}
          customTo={range.to}
          basePath="/pembayaran"
        />
        <PageSizeSelect value={limit} />
      </div>
      <form className="flex gap-2 items-center">
        {range.key && <input type="hidden" name="range" value={range.key} />}
        {sp.from && <input type="hidden" name="from" value={sp.from} />}
        {sp.to && <input type="hidden" name="to" value={sp.to} />}
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Cari nama pelanggan / telp / no order..."
          className="flex-1 px-3 py-2 border border-line rounded-md text-sm"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-brand-600 text-white rounded-md text-sm font-bold"
        >
          Cari
        </button>
        {q && (
          <a
            href="/pembayaran"
            className="px-3 py-2 text-sm text-[color:var(--muted)] hover:text-ink"
          >
            Reset
          </a>
        )}
      </form>
      <PembayaranClient rows={rows} hasSearch={!!q} />
      <Pagination page={page} totalPages={totalPages} total={total} />
    </div>
  );
}
