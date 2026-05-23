import { db } from "@/db";
import { eq, desc, gte, lte, or, ne, and, inArray, sql, like } from "drizzle-orm";
import { orderHeader, orderItem } from "@/db/schema/order";
import { pelanggan } from "@/db/schema/pelanggan";
import { produk } from "@/db/schema/produk";
import { user as userTable } from "@/db/schema/auth";
import { PageHeader } from "@/components/AppShell";
import { OrderClient, type OrderRow } from "./OrderClient";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { parseRange } from "@/lib/date-range";
import { requireRole } from "@/lib/permissions";
import { PageSizeSelect } from "@/components/PageSizeSelect";
import { Pagination } from "@/components/Pagination";
import { parseLimit, parsePage, getPagination } from "@/lib/page-size";

export const dynamic = "force-dynamic";

export default async function OrderKasirPage({
  searchParams,
}: {
  searchParams: Promise<{
    range?: string;
    from?: string;
    to?: string;
    limit?: string;
    page?: string;
    q?: string;
    status?: string;
  }>;
}) {
  const session = await requireRole(["admin", "kasir"]);
  const isAdmin = session.user.role === "admin";
  const sp = await searchParams;
  const range = parseRange(sp);
  const limit = parseLimit(sp.limit);
  const pageParam = parsePage(sp.page);
  const q = (sp.q ?? "").trim();
  const statusFilter = sp.status?.trim() || "all";

  // Filter berdasarkan range tanggal user. Default 30 hari terakhir.
  // "Aktif" (non-selesai) selalu ditampilkan terlepas range kalau di-toggle "Semua".
  const conds = [];
  if (range.from) conds.push(gte(orderHeader.createdAt, range.from));
  if (range.to) conds.push(lte(orderHeader.createdAt, range.to));
  if (statusFilter !== "all") {
    conds.push(eq(orderHeader.status, statusFilter as "pending"));
  }
  if (q) {
    const pat = `%${q}%`;
    conds.push(
      or(
        like(orderHeader.nomorOrder, pat),
        like(pelanggan.nama, pat),
        like(pelanggan.telp, pat),
      )!,
    );
  }

  const whereClause = conds.length > 0 ? and(...conds) : undefined;
  const [countRow] = await db
    .select({ n: sql<number>`count(*)` })
    .from(orderHeader)
    .leftJoin(pelanggan, eq(orderHeader.pelangganId, pelanggan.id))
    .where(whereClause);
  const total = countRow?.n ?? 0;
  const { page, totalPages, offset } = getPagination({ total, limit, page: pageParam });

  const aktif = await db
    .select({
      id: orderHeader.id,
      nomorOrder: orderHeader.nomorOrder,
      sumber: orderHeader.sumber,
      status: orderHeader.status,
      alamatAntar: orderHeader.alamatAntar,
      jadwalAntar: orderHeader.jadwalAntar,
      totalEstimasi: orderHeader.totalEstimasi,
      catatan: orderHeader.catatan,
      createdAt: orderHeader.createdAt,
      buktiFotoUrl: orderHeader.buktiFotoUrl,
      buktiJemputUrl: orderHeader.buktiJemputUrl,
      tipePengantaran: orderHeader.tipePengantaran,
      diantarAt: orderHeader.diantarAt,
      selesaiAt: orderHeader.selesaiAt,
      kurirUserId: orderHeader.kurirUserId,
      statusBayar: orderHeader.statusBayar,
      pelangganNama: pelanggan.nama,
      pelangganTelp: pelanggan.telp,
    })
    .from(orderHeader)
    .leftJoin(pelanggan, eq(orderHeader.pelangganId, pelanggan.id))
    .where(whereClause)
    .orderBy(desc(orderHeader.createdAt))
    .limit(limit)
    .offset(offset);

  // Single batch query untuk semua items + produk join (no N+1)
  const orderIds = aktif.map((o) => o.id);
  const allItems = orderIds.length
    ? await db
        .select({
          orderId: orderItem.orderId,
          qty: orderItem.qty,
          jenis: orderItem.jenis,
          produkId: orderItem.produkId,
          namaProduk: produk.nama,
        })
        .from(orderItem)
        .leftJoin(produk, eq(orderItem.produkId, produk.id))
        .where(inArray(orderItem.orderId, orderIds))
    : [];

  const itemsByOrder = new Map<number, { qty: number; jenis: string; namaProduk: string }[]>();
  for (const it of allItems) {
    const arr = itemsByOrder.get(it.orderId) ?? [];
    arr.push({
      qty: it.qty,
      jenis: it.jenis,
      namaProduk: it.namaProduk ?? `#${it.produkId}`,
    });
    itemsByOrder.set(it.orderId, arr);
  }

  const rows: OrderRow[] = aktif.map((o) => ({
    ...o,
    jadwalAntar: o.jadwalAntar?.toISOString() ?? null,
    createdAt: o.createdAt.toISOString(),
    diantarAt: o.diantarAt?.toISOString() ?? null,
    selesaiAt: o.selesaiAt?.toISOString() ?? null,
    items: itemsByOrder.get(o.id) ?? [],
  }));

  const kurirList = await db
    .select({ id: userTable.id, name: userTable.name })
    .from(userTable)
    .where(inArray(userTable.role, ["kurir", "admin", "kasir"]));

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <PageHeader title="Order Antar" description="Kelola order pengantaran yang masuk." />
        <a
          href="/kasir/order/baru"
          className="px-3 py-2 bg-brand-600 text-white rounded-md text-sm inline-flex items-center gap-1"
        >
          + Order Baru (Walk-in)
        </a>
      </div>
      <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
        <DateRangeFilter
          active={range.key}
          customFrom={range.from}
          customTo={range.to}
          basePath="/kasir/order"
        />
        <PageSizeSelect value={limit} />
      </div>
      <form className="flex gap-2 items-center mb-4">
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
            href="/kasir/order"
            className="px-3 py-2 text-sm text-[color:var(--muted)] hover:text-ink"
          >
            Reset
          </a>
        )}
      </form>
      <OrderClient
        rows={rows}
        kurirList={kurirList}
        isAdmin={isAdmin}
        statusFilter={statusFilter}
      />
      <Pagination page={page} totalPages={totalPages} total={total} />
    </div>
  );
}
