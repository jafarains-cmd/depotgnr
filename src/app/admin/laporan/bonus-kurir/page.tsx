import { sql, gte, lte, and, eq, desc, inArray } from "drizzle-orm";
import { db } from "@/db";
import { bonusKurir } from "@/db/schema/bonus";
import { orderHeader } from "@/db/schema/order";
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
import { LaporanClickProvider, LaporanRow } from "../LaporanClickable";
import { AutoSubmitSelect } from "../AutoSubmitSelect";

export const dynamic = "force-dynamic";

export default async function BonusKurirReportPage({
  searchParams,
}: {
  searchParams: Promise<{
    range?: string;
    from?: string;
    to?: string;
    userId?: string;
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
  const kurirId = sp.userId?.trim() || undefined;
  const statusFilter = sp.status?.trim() || undefined;

  const conds = [];
  if (range.from) conds.push(gte(bonusKurir.createdAt, range.from));
  if (range.to) conds.push(lte(bonusKurir.createdAt, range.to));
  if (kurirId) conds.push(eq(bonusKurir.kurirUserId, kurirId));
  if (statusFilter && statusFilter !== "all") {
    conds.push(eq(bonusKurir.status, statusFilter as "pending"));
  }
  const where = conds.length ? and(...conds) : undefined;

  const [countRow] = await db
    .select({ n: sql<number>`count(*)` })
    .from(bonusKurir)
    .where(where);
  const total = countRow?.n ?? 0;
  const { page, totalPages, offset } = getPagination({ total, limit, page: pageParam });

  const [summary] = await db
    .select({
      totalBonus: sql<number>`coalesce(sum(${bonusKurir.total}), 0)`,
      pendingTotal: sql<number>`coalesce(sum(case when ${bonusKurir.status} = 'pending' then ${bonusKurir.total} else 0 end), 0)`,
      paidTotal: sql<number>`coalesce(sum(case when ${bonusKurir.status} = 'dibayar' then ${bonusKurir.total} else 0 end), 0)`,
      totalGalon: sql<number>`coalesce(sum(${bonusKurir.jumlahGalon}), 0)`,
    })
    .from(bonusKurir)
    .where(where);

  const rows = await db
    .select({
      id: bonusKurir.id,
      orderId: bonusKurir.orderId,
      jumlahGalon: bonusKurir.jumlahGalon,
      ratePerGalon: bonusKurir.ratePerGalon,
      total: bonusKurir.total,
      status: bonusKurir.status,
      paidAt: bonusKurir.paidAt,
      createdAt: bonusKurir.createdAt,
      kurirNama: userTable.name,
      nomorOrder: orderHeader.nomorOrder,
      pelangganNama: pelangganTable.nama,
    })
    .from(bonusKurir)
    .leftJoin(userTable, eq(bonusKurir.kurirUserId, userTable.id))
    .leftJoin(orderHeader, eq(bonusKurir.orderId, orderHeader.id))
    .leftJoin(pelangganTable, eq(orderHeader.pelangganId, pelangganTable.id))
    .where(where)
    .orderBy(desc(bonusKurir.createdAt))
    .limit(limit)
    .offset(offset);

  const kurirList = await db
    .select({ id: userTable.id, name: userTable.name })
    .from(userTable)
    .where(inArray(userTable.role, ["admin", "kasir", "kurir"]));

  const fromStr = range.from?.toISOString().slice(0, 10) ?? "";
  const toStr = range.to?.toISOString().slice(0, 10) ?? "";

  return (
    <div className="p-4 md:p-6 space-y-4 laporan-print">
      <PrintStyles />
      <div className="no-print">
        <PageHeader title="Laporan Bonus Kurir" description="Rincian bonus per pengantaran." />
      </div>
      <LaporanNav active="/admin/laporan/bonus-kurir" />

      <PrintHeader title="LAPORAN BONUS KURIR" fromStr={fromStr} toStr={toStr} />

      <FilterBar
        basePath="/admin/laporan/bonus-kurir"
        rangeKey={range.key}
        rangeFrom={range.from}
        rangeTo={range.to}
        userId={kurirId}
        userList={kurirList}
        userLabel="Kurir"
        extraHidden={{ status: statusFilter }}
      />

      <form className="flex gap-2 items-center text-xs no-print">
        {range.key && range.key !== "30d" && <input type="hidden" name="range" value={range.key} />}
        {kurirId && <input type="hidden" name="userId" value={kurirId} />}
        <AutoSubmitSelect
          name="status"
          value={statusFilter ?? "all"}
          label="Status:"
          options={[
            { value: "all", label: "Semua" },
            { value: "pending", label: "Pending" },
            { value: "dibayar", label: "Sudah Dibayar" },
          ]}
        />
      </form>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="grid grid-cols-4 gap-2 text-sm flex-1 min-w-0">
          <SumCard label="Pengantaran" value={String(total)} />
          <SumCard label="Galon" value={String(summary.totalGalon)} />
          <SumCard label="Pending" value={formatRupiah(summary.pendingTotal)} color="bg-amber-50 text-amber-700" />
          <SumCard label="Dibayar" value={formatRupiah(summary.paidTotal)} color="bg-emerald-50 text-emerald-700" />
        </div>
        <PageSizeSelect value={limit} />
      </div>

      <ExportActions
        jenis="bonus-kurir"
        params={{ range: range.key, from: fromStr, to: toStr, userId: kurirId, status: statusFilter }}
      />

      <div className="bg-surface border border-line rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <LaporanClickProvider>
          <table className="w-full text-xs">
            <thead className="bg-[color:var(--surface2)] text-[color:var(--muted)] text-left">
              <tr>
                <th className="p-2">Tanggal</th>
                <th className="p-2">No. Order</th>
                <th className="p-2">Kurir</th>
                <th className="p-2">Pelanggan</th>
                <th className="p-2 text-right">Galon</th>
                <th className="p-2 text-right">Rate</th>
                <th className="p-2 text-right">Total Bonus</th>
                <th className="p-2">Status</th>
                <th className="p-2">Dibayar pada</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <LaporanRow key={r.id} target={{ kind: "order", id: r.orderId }}>
                  <td className="p-2 whitespace-nowrap">
                    {r.createdAt.toLocaleDateString("id-ID", {
                      day: "2-digit",
                      month: "short",
                      year: "2-digit",
                    })}
                  </td>
                  <td className="p-2 font-mono">{r.nomorOrder ?? `#${r.orderId}`}</td>
                  <td className="p-2">{r.kurirNama ?? "-"}</td>
                  <td className="p-2">{r.pelangganNama ?? "-"}</td>
                  <td className="p-2 text-right">{r.jumlahGalon}</td>
                  <td className="p-2 text-right">{formatRupiah(r.ratePerGalon)}</td>
                  <td className="p-2 text-right font-bold text-amber-700">
                    {formatRupiah(r.total)}
                  </td>
                  <td className="p-2 uppercase">{r.status}</td>
                  <td className="p-2 whitespace-nowrap">
                    {r.paidAt
                      ? r.paidAt.toLocaleDateString("id-ID", {
                          day: "2-digit",
                          month: "short",
                          year: "2-digit",
                        })
                      : "-"}
                  </td>
                </LaporanRow>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-[color:var(--muted)]">
                    Tidak ada bonus pada filter ini.
                  </td>
                </tr>
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot className="bg-[color:var(--surface2)] font-bold">
                <tr>
                  <td colSpan={6} className="p-2 text-right">
                    TOTAL halaman ini:
                  </td>
                  <td className="p-2 text-right text-amber-700">
                    {formatRupiah(rows.reduce((s, r) => s + r.total, 0))}
                  </td>
                  <td colSpan={2}></td>
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

function SumCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className={`rounded-xl border border-line px-3 py-2 ${color ?? "bg-surface"}`}>
      <div className="text-[10px] tracking-widest font-bold text-[color:var(--muted)]">
        {label}
      </div>
      <div className="text-base font-extrabold mt-0.5">{value}</div>
    </div>
  );
}
