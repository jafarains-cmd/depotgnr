import { sql, gte, lte, and, eq, desc, like, or, inArray } from "drizzle-orm";
import { db } from "@/db";
import { orderHeader, orderItem } from "@/db/schema/order";
import { user as userTable } from "@/db/schema/auth";
import { pelanggan as pelangganTable } from "@/db/schema/pelanggan";
import { PageHeader } from "@/components/AppShell";
import { requireRole } from "@/lib/permissions";
import { formatRupiah } from "@/lib/utils";
import { parseRange } from "@/lib/date-range";
import { parseLimit, parsePage, getPagination } from "@/lib/page-size";
import { PageSizeSelect } from "@/components/PageSizeSelect";
import { Pagination } from "@/components/Pagination";
import { LaporanNav } from "../LaporanNav";
import { FilterBar } from "../FilterBar";
import { ExportActions } from "../ExportActions";
import { PrintStyles, PrintHeader } from "../PrintStyles";
import { AutoSubmitSelect } from "../AutoSubmitSelect";
import { LaporanClickProvider, LaporanRow } from "../LaporanClickable";

export const dynamic = "force-dynamic";

export default async function OrderAntarReportPage({
  searchParams,
}: {
  searchParams: Promise<{
    range?: string;
    from?: string;
    to?: string;
    q?: string;
    userId?: string;
    pelangganId?: string;
    status?: string;
    limit?: string;
    page?: string;
  }>;
}) {
  await requireRole(["admin"]);
  const sp = await searchParams;
  const range = parseRange(sp);
  const limit = parseLimit(sp.limit);
  const pageParam = parsePage(sp.page);
  const q = (sp.q ?? "").trim();
  const kurirId = sp.userId?.trim() || undefined;
  const pelangganId = sp.pelangganId?.trim() || undefined;
  const statusFilter = sp.status?.trim() || undefined;

  const conds = [];
  if (range.from) conds.push(gte(orderHeader.createdAt, range.from));
  if (range.to) conds.push(lte(orderHeader.createdAt, range.to));
  if (kurirId) conds.push(eq(orderHeader.kurirUserId, kurirId));
  if (pelangganId) conds.push(eq(orderHeader.pelangganId, Number(pelangganId)));
  if (statusFilter && statusFilter !== "all") {
    conds.push(eq(orderHeader.status, statusFilter as "pending"));
  }
  if (q) {
    const pat = `%${q}%`;
    conds.push(
      or(
        like(orderHeader.nomorOrder, pat),
        like(pelangganTable.nama, pat),
        like(orderHeader.alamatAntar, pat),
        like(orderHeader.catatan, pat),
      )!,
    );
  }
  const where = conds.length ? and(...conds) : undefined;

  const [countRow] = await db
    .select({ n: sql<number>`count(*)` })
    .from(orderHeader)
    .leftJoin(pelangganTable, eq(orderHeader.pelangganId, pelangganTable.id))
    .where(where);
  const total = countRow?.n ?? 0;
  const { page, totalPages, offset } = getPagination({ total, limit, page: pageParam });

  const [summary] = await db
    .select({
      totalNilai: sql<number>`coalesce(sum(${orderHeader.totalEstimasi}), 0)`,
    })
    .from(orderHeader)
    .leftJoin(pelangganTable, eq(orderHeader.pelangganId, pelangganTable.id))
    .where(where);

  const rows = await db
    .select({
      id: orderHeader.id,
      nomorOrder: orderHeader.nomorOrder,
      createdAt: orderHeader.createdAt,
      diantarAt: orderHeader.diantarAt,
      selesaiAt: orderHeader.selesaiAt,
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
    .orderBy(desc(orderHeader.createdAt))
    .limit(limit)
    .offset(offset);

  const ids = rows.map((r) => r.id);
  const galonMap = new Map<number, number>();
  if (ids.length) {
    const items = await db
      .select({ orderId: orderItem.orderId, qty: orderItem.qty })
      .from(orderItem)
      .where(inArray(orderItem.orderId, ids));
    for (const it of items) {
      galonMap.set(it.orderId, (galonMap.get(it.orderId) ?? 0) + it.qty);
    }
  }

  const [kurirList, pelangganListAll] = await Promise.all([
    db
      .select({ id: userTable.id, name: userTable.name })
      .from(userTable)
      .where(inArray(userTable.role, ["admin", "kasir", "kurir"])),
    db
      .select({ id: pelangganTable.id, nama: pelangganTable.nama })
      .from(pelangganTable)
      .orderBy(pelangganTable.nama)
      .limit(500),
  ]);

  const fromStr = range.from?.toISOString().slice(0, 10) ?? "";
  const toStr = range.to?.toISOString().slice(0, 10) ?? "";

  return (
    <div className="p-4 md:p-6 space-y-4 laporan-print">
      <PrintStyles />
      <div className="no-print">
        <PageHeader title="Laporan Order Antar" description="Rincian order yang diantar oleh kurir." />
      </div>
      <LaporanNav active="/admin/laporan/order-antar" />

      <PrintHeader title="LAPORAN ORDER ANTAR" fromStr={fromStr} toStr={toStr} />

      <FilterBar
        basePath="/admin/laporan/order-antar"
        rangeKey={range.key}
        rangeFrom={range.from}
        rangeTo={range.to}
        q={q}
        userId={kurirId}
        userList={kurirList}
        userLabel="Kurir"
        pelangganId={pelangganId}
        pelangganList={pelangganListAll}
        showPelanggan
        extraHidden={{ status: statusFilter }}
      />

      <form className="flex gap-2 items-center text-xs no-print">
        {range.key && range.key !== "30d" && <input type="hidden" name="range" value={range.key} />}
        {q && <input type="hidden" name="q" value={q} />}
        {kurirId && <input type="hidden" name="userId" value={kurirId} />}
        {pelangganId && <input type="hidden" name="pelangganId" value={pelangganId} />}
        <AutoSubmitSelect
          name="status"
          value={statusFilter ?? "all"}
          label="Status:"
          options={[
            { value: "all", label: "Semua" },
            { value: "pending", label: "Pending" },
            { value: "diproses", label: "Diproses" },
            { value: "dijemput", label: "Dijemput" },
            { value: "diisi", label: "Diisi" },
            { value: "diantar", label: "Diantar" },
            { value: "selesai", label: "Selesai" },
            { value: "batal", label: "Batal" },
          ]}
        />
      </form>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="grid grid-cols-2 gap-2 text-sm flex-1 min-w-0">
          <SumCard label="Order" value={String(total)} />
          <SumCard label="Total Nilai" value={formatRupiah(summary.totalNilai)} highlight />
        </div>
        <PageSizeSelect value={limit} />
      </div>

      <ExportActions
        jenis="order-antar"
        params={{
          range: range.key,
          from: fromStr,
          to: toStr,
          q,
          userId: kurirId,
          pelangganId,
          status: statusFilter,
        }}
      />

      <div className="bg-surface border border-line rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <LaporanClickProvider>
          <table className="w-full text-xs">
            <thead className="bg-[color:var(--surface2)] text-[color:var(--muted)] text-left">
              <tr>
                <th className="p-2">Tanggal</th>
                <th className="p-2">No. Order</th>
                <th className="p-2">Status</th>
                <th className="p-2">Kurir</th>
                <th className="p-2">Pelanggan</th>
                <th className="p-2">Telp</th>
                <th className="p-2">Alamat</th>
                <th className="p-2 text-right">Galon</th>
                <th className="p-2">Bayar</th>
                <th className="p-2 text-right">Total</th>
                <th className="p-2">Antar pada</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <LaporanRow key={r.id} target={{ kind: "order", id: r.id }}>
                  <td className="p-2 whitespace-nowrap">
                    {r.createdAt.toLocaleString("id-ID", {
                      day: "2-digit",
                      month: "short",
                      year: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="p-2 font-mono">{r.nomorOrder}</td>
                  <td className="p-2 uppercase">{r.status}</td>
                  <td className="p-2">{r.kurirNama ?? "-"}</td>
                  <td className="p-2">{r.pelangganNama ?? "—"}</td>
                  <td className="p-2">{r.pelangganTelp ?? "-"}</td>
                  <td className="p-2 max-w-[200px] truncate" title={r.alamatAntar ?? ""}>
                    {r.alamatAntar ?? "-"}
                  </td>
                  <td className="p-2 text-right">{galonMap.get(r.id) ?? 0}</td>
                  <td className="p-2 uppercase">
                    {(r.metodeBayar ?? "-") + " / " + r.statusBayar}
                  </td>
                  <td className="p-2 text-right font-bold">
                    {formatRupiah(r.totalEstimasi)}
                  </td>
                  <td className="p-2 whitespace-nowrap">
                    {r.diantarAt
                      ? r.diantarAt.toLocaleDateString("id-ID", {
                          day: "2-digit",
                          month: "short",
                        })
                      : "-"}
                  </td>
                </LaporanRow>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-[color:var(--muted)]">
                    Tidak ada order pada filter ini.
                  </td>
                </tr>
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot className="bg-[color:var(--surface2)] font-bold">
                <tr>
                  <td colSpan={9} className="p-2 text-right">
                    TOTAL halaman ini:
                  </td>
                  <td className="p-2 text-right text-brand">
                    {formatRupiah(rows.reduce((s, r) => s + r.totalEstimasi, 0))}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
          </LaporanClickProvider>
        </div>
      </div>

      <Pagination page={page} totalPages={totalPages} total={total} />
    </div>
  );
}

function SumCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className={`rounded-xl border border-line px-3 py-2 ${
        highlight ? "bg-blue-50 text-blue-700" : "bg-surface"
      }`}
    >
      <div className="text-[10px] tracking-widest font-bold text-[color:var(--muted)]">
        {label}
      </div>
      <div className="text-base font-extrabold mt-0.5">{value}</div>
    </div>
  );
}
