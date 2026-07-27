import { eq, desc, asc, ne, and, gte, lte, sql, like, or } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { db } from "@/db";
import { orderHeader } from "@/db/schema/order";
import { pelanggan as pelangganTable } from "@/db/schema/pelanggan";
import { user as userTable } from "@/db/schema/auth";
import { notaGabungan } from "@/db/schema/nota-gabungan";

const pembuatUser = alias(userTable, "pembuat_user");
const konfirmasiUser = alias(userTable, "konfirmasi_user");
import { requireRole } from "@/lib/permissions";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { parseRange } from "@/lib/date-range";
import { PembayaranClient, type Row } from "./PembayaranClient";
import { PageSizeSelect } from "@/components/PageSizeSelect";
import { Pagination } from "@/components/Pagination";
import { parseLimit, parsePage, getPagination } from "@/lib/page-size";
import { SortAutoSubmit } from "./SortAutoSubmit";
import { TabNav } from "./TabNav";
import { getPiutangThreshold, countPiutangMenua } from "@/lib/piutang";
import {
  getPiutangNeedReminder,
  buildWaLink,
  getDepotContext,
} from "@/lib/reminder-piutang";
import { ReminderSection, type ReminderRow } from "./ReminderSection";

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

  const piutangThresholdHari = await getPiutangThreshold();
  const piutangMenuaCount = await countPiutangMenua();

  // Ambil daftar piutang yang butuh reminder + generate WA link per row
  const [needReminder, depotCtx] = await Promise.all([
    getPiutangNeedReminder(),
    getDepotContext(),
  ]);
  const reminderRows: ReminderRow[] = needReminder.map((r) => ({
    orderId: r.orderId,
    nomorOrder: r.nomorOrder,
    pelangganNama: r.pelangganNama,
    pelangganTelp: r.pelangganTelp,
    totalPiutang: r.totalPiutang,
    daysAge: r.daysAge,
    currentStage: r.currentStage,
    lastReminderStage: r.lastReminderStage,
    waLink: buildWaLink({
      pelangganNama: r.pelangganNama,
      pelangganTelp: r.pelangganTelp,
      nomorOrder: r.nomorOrder,
      totalPiutang: r.totalPiutang,
      createdAt: r.createdAt,
      daysAge: r.daysAge,
      stage: r.currentStage,
      namaDepot: depotCtx.namaDepot,
      telpDepot: depotCtx.telpDepot,
    }),
  }));

  const list = await db
    .select({
      id: orderHeader.id,
      nomorOrder: orderHeader.nomorOrder,
      totalEstimasi: orderHeader.totalEstimasi,
      paidPartial: orderHeader.paidPartial,
      metodeBayar: orderHeader.metodeBayar,
      statusBayar: orderHeader.statusBayar,
      statusOrder: orderHeader.status,
      buktiBayarUrl: orderHeader.buktiBayarUrl,
      bayarAt: orderHeader.bayarAt,
      diantarAt: orderHeader.diantarAt,
      selesaiAt: orderHeader.selesaiAt,
      createdAt: orderHeader.createdAt,
      pelangganNama: pelangganTable.nama,
      pelangganTelp: pelangganTable.telp,
      notaGabunganId: orderHeader.notaGabunganId,
      notaGabunganKode: notaGabungan.kode,
      pembuatNama: pembuatUser.name,
      konfirmasiNama: konfirmasiUser.name,
    })
    .from(orderHeader)
    .leftJoin(pelangganTable, eq(orderHeader.pelangganId, pelangganTable.id))
    .leftJoin(notaGabungan, eq(orderHeader.notaGabunganId, notaGabungan.id))
    .leftJoin(pembuatUser, eq(orderHeader.kurirUserId, pembuatUser.id))
    .leftJoin(konfirmasiUser, eq(orderHeader.bayarDikonfirmasiOleh, konfirmasiUser.id))
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
    paidPartial: r.paidPartial,
    metode: r.metodeBayar,
    status: r.statusBayar,
    statusOrder: r.statusOrder,
    buktiUrl: r.buktiBayarUrl,
    bayarAt: r.bayarAt?.toISOString() ?? null,
    diantarAt: r.diantarAt?.toISOString() ?? null,
    selesaiAt: r.selesaiAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    pelangganNama: r.pelangganNama,
    pelangganTelp: r.pelangganTelp,
    notaGabunganId: r.notaGabunganId,
    notaGabunganKode: r.notaGabunganKode,
    pembuatNama: r.pembuatNama,
    konfirmasiNama: r.konfirmasiNama,
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
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold">Konfirmasi Pembayaran</h1>
          <p className="text-sm text-[color:var(--muted)]">
            Review bukti pembayaran, tandai lunas piutang, atau lihat history.
          </p>
        </div>
        <a
          href="/admin/nota-gabungan"
          className="text-xs px-3 py-2 bg-violet-100 text-violet-800 rounded-md font-bold inline-flex items-center gap-1"
        >
          Buat Nota Gabungan →
        </a>
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
      {piutangMenuaCount > 0 && (
        <a
          href="/pembayaran?tab=piutang&sort=order-asc"
          className="block bg-red-50 border border-red-200 rounded-2xl p-3 text-sm hover:bg-red-100"
        >
          <div className="font-bold text-red-900 inline-flex items-center gap-1.5">
            🚨 {piutangMenuaCount} piutang menua (umur &gt; {piutangThresholdHari} hari)
          </div>
          <div className="text-xs text-red-800 mt-0.5">
            Tagih segera atau hubungi pelanggan. Klik untuk filter ke piutang.
          </div>
        </a>
      )}
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
      {reminderRows.length > 0 && <ReminderSection rows={reminderRows} />}
      <PembayaranClient rows={rows} piutangThresholdHari={piutangThresholdHari} />
      <Pagination page={page} totalPages={totalPages} total={total} />
    </div>
  );
}
