import { eq, desc, asc, ne, and, gte, lte, sql, like, or } from "drizzle-orm";
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
import { SortAutoSubmit } from "./SortAutoSubmit";
import { TabNav } from "./TabNav";

export const dynamic = "force-dynamic";

type Tab = "menunggu" | "piutang" | "lunas" | "all";

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
    sort?: string;
    tab?: string;
  }>;
}) {
  await requireRole(["admin", "kasir"]);
  const sp = await searchParams;
  const range = parseRange(sp);
  const limit = parseLimit(sp.limit);
  const pageParam = parsePage(sp.page);
  const q = (sp.q ?? "").trim();
  const sortKey = sp.sort ?? "order-desc";
  const tab: Tab = (["menunggu", "piutang", "lunas", "all"] as const).includes(
    (sp.tab ?? "") as Tab,
  )
    ? (sp.tab as Tab)
    : "menunggu";

  // Base condition: bukan batal + status bayar yang relevan
  const baseConds = [
    ne(orderHeader.status, "batal"),
    sql`(${orderHeader.statusBayar} = 'menunggu' OR ${orderHeader.statusBayar} = 'lunas' OR (${orderHeader.status} = 'selesai' AND ${orderHeader.statusBayar} = 'belum'))`,
  ];
  if (range.from) baseConds.push(gte(orderHeader.createdAt, range.from));
  if (range.to) baseConds.push(lte(orderHeader.createdAt, range.to));
  if (q) {
    const pat = `%${q}%`;
    baseConds.push(
      or(
        like(orderHeader.nomorOrder, pat),
        like(pelangganTable.nama, pat),
        like(pelangganTable.telp, pat),
      )!,
    );
  }

  // Tab-specific filter — applied di SQL untuk akurasi count + pagination
  const tabConds = [...baseConds];
  if (tab === "menunggu") {
    tabConds.push(eq(orderHeader.statusBayar, "menunggu"));
  } else if (tab === "piutang") {
    tabConds.push(eq(orderHeader.status, "selesai"));
    tabConds.push(eq(orderHeader.statusBayar, "belum"));
  } else if (tab === "lunas") {
    tabConds.push(eq(orderHeader.statusBayar, "lunas"));
  }

  const whereClause = and(...tabConds);

  // Count untuk pagination tab aktif
  const [countRow] = await db
    .select({ n: sql<number>`count(*)` })
    .from(orderHeader)
    .leftJoin(pelangganTable, eq(orderHeader.pelangganId, pelangganTable.id))
    .where(whereClause);
  const total = countRow?.n ?? 0;
  const { page, totalPages, offset } = getPagination({ total, limit, page: pageParam });

  // Counts terpisah untuk tampil di tab badge
  const baseWhere = and(...baseConds);
  const [allCount] = await db
    .select({ n: sql<number>`count(*)` })
    .from(orderHeader)
    .leftJoin(pelangganTable, eq(orderHeader.pelangganId, pelangganTable.id))
    .where(baseWhere);
  const [menungguCount] = await db
    .select({ n: sql<number>`count(*)` })
    .from(orderHeader)
    .leftJoin(pelangganTable, eq(orderHeader.pelangganId, pelangganTable.id))
    .where(and(...baseConds, eq(orderHeader.statusBayar, "menunggu")));
  const [piutangCount] = await db
    .select({ n: sql<number>`count(*)` })
    .from(orderHeader)
    .leftJoin(pelangganTable, eq(orderHeader.pelangganId, pelangganTable.id))
    .where(
      and(
        ...baseConds,
        eq(orderHeader.status, "selesai"),
        eq(orderHeader.statusBayar, "belum"),
      ),
    );
  const [lunasCount] = await db
    .select({ n: sql<number>`count(*)` })
    .from(orderHeader)
    .leftJoin(pelangganTable, eq(orderHeader.pelangganId, pelangganTable.id))
    .where(and(...baseConds, eq(orderHeader.statusBayar, "lunas")));

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
    .orderBy(
      sortKey === "order-asc"
        ? asc(orderHeader.createdAt)
        : sortKey === "bayar-desc"
          ? desc(orderHeader.bayarAt)
          : sortKey === "bayar-asc"
            ? asc(orderHeader.bayarAt)
            : desc(orderHeader.createdAt),
    )
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

  // Query string base untuk preserve filter di tab links
  const baseQuery = new URLSearchParams();
  if (range.key) baseQuery.set("range", range.key);
  if (sp.from) baseQuery.set("from", sp.from);
  if (sp.to) baseQuery.set("to", sp.to);
  if (q) baseQuery.set("q", q);
  if (sortKey !== "order-desc") baseQuery.set("sort", sortKey);
  if (sp.limit) baseQuery.set("limit", sp.limit);

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
      <form className="flex gap-2 items-center flex-wrap">
        {range.key && <input type="hidden" name="range" value={range.key} />}
        {sp.from && <input type="hidden" name="from" value={sp.from} />}
        {sp.to && <input type="hidden" name="to" value={sp.to} />}
        <input type="hidden" name="tab" value={tab} />
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Cari nama pelanggan / telp / no order..."
          className="flex-1 min-w-[200px] px-3 py-2 border border-line rounded-md text-sm"
        />
        <SortAutoSubmit value={sortKey} />
        <button
          type="submit"
          className="px-4 py-2 bg-brand-600 text-white rounded-md text-sm font-bold"
        >
          Cari
        </button>
        {(q || sortKey !== "order-desc") && (
          <a
            href={`/pembayaran?tab=${tab}`}
            className="px-3 py-2 text-sm text-[color:var(--muted)] hover:text-ink"
          >
            Reset
          </a>
        )}
      </form>
      <TabNav
        active={tab}
        counts={{
          all: allCount?.n ?? 0,
          menunggu: menungguCount?.n ?? 0,
          piutang: piutangCount?.n ?? 0,
          lunas: lunasCount?.n ?? 0,
        }}
        baseQuery={baseQuery.toString()}
      />
      <PembayaranClient rows={rows} />
      <Pagination page={page} totalPages={totalPages} total={total} />
    </div>
  );
}
