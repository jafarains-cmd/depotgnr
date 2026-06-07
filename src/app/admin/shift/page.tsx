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
import { getShiftStaleList, isShiftStale } from "@/lib/shift";

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

      <div className="bg-surface border border-line rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[color:var(--surface2)] text-[color:var(--muted)] text-left text-xs">
              <tr>
                <th className="p-3">Kasir</th>
                <th className="p-3">Buka</th>
                <th className="p-3">Tutup</th>
                <th className="p-3 text-right">Uang awal</th>
                <th className="p-3 text-right">Ekspektasi</th>
                <th className="p-3 text-right">Fisik</th>
                <th className="p-3 text-right">Selisih</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => {
                const stale = r.status === "open" && isShiftStale(r.openedAt);
                return (
                <tr key={r.id} className={stale ? "bg-red-50" : ""}>
                  <td className="p-3 text-xs">
                    <div className="font-bold">{r.kasirNama ?? "—"}</div>
                    <div className="text-[10px] text-[color:var(--muted)] uppercase">
                      {r.kasirRole ?? "—"}
                    </div>
                    {r.catatan && (
                      <div className="text-[10px] italic text-[color:var(--muted)] mt-1 max-w-[200px]">
                        "{r.catatan}"
                      </div>
                    )}
                  </td>
                  <td className="p-3 text-xs whitespace-nowrap">
                    {r.openedAt.toLocaleString("id-ID", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {r.reopenedAt && (
                      <div className="text-[10px] text-amber-700 mt-0.5">↻ reopened</div>
                    )}
                  </td>
                  <td className="p-3 text-xs whitespace-nowrap">
                    {r.closedAt
                      ? r.closedAt.toLocaleString("id-ID", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                    {r.closedByNama && r.closedByNama !== r.kasirNama && (
                      <div className="text-[10px] text-[color:var(--muted)]">
                        by {r.closedByNama}
                      </div>
                    )}
                  </td>
                  <td className="p-3 text-xs text-right font-mono">
                    {r.openingCash !== null ? formatRupiah(r.openingCash) : "—"}
                  </td>
                  <td className="p-3 text-xs text-right font-mono">
                    {r.closingCashExpected !== null
                      ? formatRupiah(r.closingCashExpected)
                      : "—"}
                  </td>
                  <td className="p-3 text-xs text-right font-mono">
                    {r.closingCashCounted !== null
                      ? formatRupiah(r.closingCashCounted)
                      : "—"}
                  </td>
                  <td
                    className={`p-3 text-xs text-right font-mono font-bold ${
                      (r.selisih ?? 0) === 0
                        ? "text-[color:var(--muted)]"
                        : (r.selisih ?? 0) > 0
                          ? "text-emerald-700"
                          : "text-red-600"
                    }`}
                  >
                    {r.selisih !== null
                      ? `${r.selisih > 0 ? "+" : ""}${formatRupiah(r.selisih)}`
                      : "—"}
                  </td>
                  <td className="p-3">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        stale
                          ? "bg-red-600 text-white animate-pulse"
                          : r.status === "open"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-[color:var(--surface2)] text-[color:var(--muted)]"
                      }`}
                    >
                      {stale ? "STALE" : r.status.toUpperCase()}
                    </span>
                  </td>
                </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-[color:var(--muted)]">
                    Belum ada shift.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination page={page} totalPages={totalPages} total={total} />
    </div>
  );
}
