import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import { db } from "@/db";
import { shiftKasir } from "@/db/schema/shift";
import { user as userTable } from "@/db/schema/auth";
import { requireRole } from "@/lib/permissions";
import { PageHeader } from "@/components/AppShell";
import { PageSizeSelect } from "@/components/PageSizeSelect";
import { Pagination } from "@/components/Pagination";
import { parseLimit, parsePage, getPagination } from "@/lib/page-size";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { parseRange } from "@/lib/date-range";
import { formatRupiah } from "@/lib/utils";
import { alias } from "drizzle-orm/sqlite-core";
import {
  getShiftStaleList,
  isShiftStale,
  ringkasanShift,
  getShiftStaleThresholdJam,
} from "@/lib/shift";
import { ShiftRows, type Row as ShiftRowData } from "./ShiftRows";

const closedByUser = alias(userTable, "closed_by_user");

export const dynamic = "force-dynamic";

export default async function AdminShiftPage({
  searchParams,
}: {
  searchParams: Promise<{
    range?: string;
    from?: string;
    to?: string;
    limit?: string;
    page?: string;
    status?: string;
  }>;
}) {
  await requireRole(["admin"]);
  const sp = await searchParams;
  const staleList = await getShiftStaleList();
  const staleThreshold = await getShiftStaleThresholdJam();
  const range = parseRange(sp);
  const limit = parseLimit(sp.limit);
  const pageParam = parsePage(sp.page);
  const statusFilter = (sp.status ?? "").trim();

  const conds = [];
  if (range.from) conds.push(gte(shiftKasir.openedAt, range.from));
  if (range.to) conds.push(lte(shiftKasir.openedAt, range.to));
  if (statusFilter === "open" || statusFilter === "closed") {
    conds.push(eq(shiftKasir.status, statusFilter));
  }
  const whereClause = conds.length > 0 ? and(...conds) : undefined;

  const [countRow] = await db
    .select({ n: sql<number>`count(*)` })
    .from(shiftKasir)
    .where(whereClause);
  const total = countRow?.n ?? 0;
  const { page, totalPages, offset } = getPagination({ total, limit, page: pageParam });

  const rows = await db
    .select({
      id: shiftKasir.id,
      kasirNama: userTable.name,
      kasirRole: userTable.role,
      openingCash: shiftKasir.openingCash,
      closingCashCounted: shiftKasir.closingCashCounted,
      closingCashExpected: shiftKasir.closingCashExpected,
      selisih: shiftKasir.selisih,
      catatan: shiftKasir.catatan,
      status: shiftKasir.status,
      openedAt: shiftKasir.openedAt,
      closedAt: shiftKasir.closedAt,
      closedByNama: closedByUser.name,
      reopenedAt: shiftKasir.reopenedAt,
    })
    .from(shiftKasir)
    .leftJoin(userTable, eq(shiftKasir.kasirUserId, userTable.id))
    .leftJoin(closedByUser, eq(shiftKasir.closedByUserId, closedByUser.id))
    .where(whereClause)
    .orderBy(desc(shiftKasir.openedAt))
    .limit(limit)
    .offset(offset);

  const [aggRow] = await db
    .select({
      totalSelisih: sql<number>`coalesce(sum(${shiftKasir.selisih}), 0)`,
      jumlahShift: sql<number>`count(*)`,
    })
    .from(shiftKasir)
    .where(whereClause);

  // Hitung ekspektasi cash untuk shift open (untuk pass ke force-close button)
  const openShiftIds = rows.filter((r) => r.status === "open").map((r) => r.id);
  const expectedMap = new Map<number, number>();
  for (const id of openShiftIds) {
    const ring = await ringkasanShift(id);
    expectedMap.set(id, ring.expected);
  }

  // Aggregate per kasir (top 10) — siapa paling sering shift + total selisih kumulatif
  const perKasirRaw = await db
    .select({
      kasirUserId: shiftKasir.kasirUserId,
      kasirNama: userTable.name,
      jumlahShift: sql<number>`count(*)`,
      totalSelisih: sql<number>`coalesce(sum(${shiftKasir.selisih}), 0)`,
      shiftStale: sql<number>`coalesce(sum(case when ${shiftKasir.status} = 'open' then 1 else 0 end), 0)`,
    })
    .from(shiftKasir)
    .leftJoin(userTable, eq(shiftKasir.kasirUserId, userTable.id))
    .where(whereClause)
    .groupBy(shiftKasir.kasirUserId)
    .orderBy(desc(sql<number>`count(*)`))
    .limit(10);

  return (
    <div className="p-4 md:p-6 max-w-6xl space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <PageHeader
          title="Shift Kasir"
          description="Riwayat semua shift kasir + selisih kas. Append-only audit log."
        />
        <PageSizeSelect value={limit} />
      </div>

      {staleList.length > 0 && (
        <div className="bg-red-50 border border-red-300 rounded-2xl p-4 space-y-3">
          <div>
            <div className="text-[10px] font-bold tracking-widest text-red-800">
              ⚠ SHIFT BELUM DITUTUP (CROSS-MIDNIGHT)
            </div>
            <div className="text-sm text-red-900 mt-1">
              {staleList.length} shift kasir terbuka sejak hari kemarin. Omzet akan
              bercampur 2 hari kalau dibiarkan. Notif sudah dikirim ke grup WA &
              Telegram.
            </div>
          </div>
          <div className="space-y-1.5">
            {staleList.map((s) => {
              const hours = Math.round(
                (Date.now() - s.openedAt.getTime()) / (60 * 60 * 1000),
              );
              return (
                <div
                  key={s.id}
                  className="bg-white border border-red-200 rounded-lg p-2 flex justify-between items-center"
                >
                  <div>
                    <div className="font-bold text-sm">{s.kasirNama ?? "—"}</div>
                    <div className="text-[11px] text-[color:var(--muted)]">
                      Buka sejak{" "}
                      {s.openedAt.toLocaleString("id-ID", {
                        timeZone: "Asia/Makassar",
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      ({hours} jam lalu)
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-surface border border-line rounded-xl p-3">
          <div className="text-[10px] font-bold tracking-widest text-[color:var(--muted)]">
            JUMLAH SHIFT
          </div>
          <div className="text-2xl font-extrabold">{aggRow?.jumlahShift ?? 0}</div>
        </div>
        <div className="bg-surface border border-line rounded-xl p-3">
          <div className="text-[10px] font-bold tracking-widest text-[color:var(--muted)]">
            TOTAL SELISIH KAS
          </div>
          <div
            className={`text-2xl font-extrabold ${
              (aggRow?.totalSelisih ?? 0) === 0
                ? "text-[color:var(--muted)]"
                : (aggRow?.totalSelisih ?? 0) > 0
                  ? "text-emerald-700"
                  : "text-red-600"
            }`}
          >
            {(aggRow?.totalSelisih ?? 0) > 0 ? "+" : ""}
            {formatRupiah(aggRow?.totalSelisih ?? 0)}
          </div>
        </div>
      </div>

      <DateRangeFilter
        active={range.key}
        customFrom={range.from}
        customTo={range.to}
        basePath="/admin/shift"
      />

      {perKasirRaw.length > 0 && (
        <section>
          <h2 className="text-xs font-bold tracking-widest text-[color:var(--muted)] mb-2">
            REKAP PER KASIR
          </h2>
          <div className="bg-surface border border-line rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[color:var(--surface2)] text-[color:var(--muted)] text-left text-xs">
                <tr>
                  <th className="p-3">Kasir</th>
                  <th className="p-3 text-right">Jumlah Shift</th>
                  <th className="p-3 text-right">Open</th>
                  <th className="p-3 text-right">Total Selisih</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {perKasirRaw.map((k) => (
                  <tr key={k.kasirUserId}>
                    <td className="p-3 font-bold">{k.kasirNama ?? "—"}</td>
                    <td className="p-3 text-right text-xs">{k.jumlahShift}</td>
                    <td className="p-3 text-right text-xs">
                      {Number(k.shiftStale) > 0 ? (
                        <span className="text-emerald-700 font-bold">{k.shiftStale}</span>
                      ) : (
                        <span className="text-[color:var(--muted)]">0</span>
                      )}
                    </td>
                    <td
                      className={`p-3 text-right text-xs font-mono font-bold ${
                        Number(k.totalSelisih) === 0
                          ? "text-[color:var(--muted)]"
                          : Number(k.totalSelisih) > 0
                            ? "text-emerald-700"
                            : "text-red-600"
                      }`}
                    >
                      {Number(k.totalSelisih) > 0 ? "+" : ""}
                      {formatRupiah(Number(k.totalSelisih))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div className="flex gap-1 text-sm flex-wrap">
        {[
          { f: "", label: "Semua" },
          { f: "open", label: "Open" },
          { f: "closed", label: "Closed" },
        ].map((t) => (
          <a
            key={t.f}
            href={t.f ? `/admin/shift?status=${t.f}` : "/admin/shift"}
            className={`px-3 py-1.5 rounded-md ${
              statusFilter === t.f
                ? "bg-brand-600 text-white"
                : "bg-surface border border-line"
            }`}
          >
            {t.label}
          </a>
        ))}
      </div>

      {(() => {
        const shiftRows: ShiftRowData[] = rows.map((r) => ({
          id: r.id,
          kasirNama: r.kasirNama,
          kasirRole: r.kasirRole,
          openingCash: r.openingCash,
          closingCashCounted: r.closingCashCounted,
          closingCashExpected: r.closingCashExpected,
          selisih: r.selisih,
          catatan: r.catatan,
          status: r.status,
          openedAt: r.openedAt,
          closedAt: r.closedAt,
          closedByNama: r.closedByNama,
          reopenedAt: r.reopenedAt,
          stale: r.status === "open" && isShiftStale(r.openedAt, staleThreshold),
          expectedForOpen: expectedMap.get(r.id) ?? 0,
        }));
        return <ShiftRows rows={shiftRows} />;
      })()}


      <Pagination page={page} totalPages={totalPages} total={total} />
    </div>
  );
}
