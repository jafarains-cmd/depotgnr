import { eq, desc, like, and, sql, or } from "drizzle-orm";
import { db } from "@/db";
import { auditLog } from "@/db/schema/audit";
import { user as userTable } from "@/db/schema/auth";
import { requireRole } from "@/lib/permissions";
import { PageHeader } from "@/components/AppShell";
import { PageSizeSelect } from "@/components/PageSizeSelect";
import { Pagination } from "@/components/Pagination";
import { parseLimit, parsePage, getPagination } from "@/lib/page-size";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { parseRange } from "@/lib/date-range";
import { gte, lte } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{
    range?: string;
    from?: string;
    to?: string;
    limit?: string;
    page?: string;
    q?: string;
    entity?: string;
    action?: string;
  }>;
}) {
  await requireRole(["admin"]);
  const sp = await searchParams;
  const range = parseRange(sp);
  const limit = parseLimit(sp.limit);
  const pageParam = parsePage(sp.page);
  const q = (sp.q ?? "").trim();
  const entityFilter = (sp.entity ?? "").trim();
  const actionFilter = (sp.action ?? "").trim();

  const conds = [];
  if (range.from) conds.push(gte(auditLog.createdAt, range.from));
  if (range.to) conds.push(lte(auditLog.createdAt, range.to));
  if (entityFilter) conds.push(eq(auditLog.entity, entityFilter));
  if (actionFilter) conds.push(like(auditLog.action, `%${actionFilter}%`));
  if (q) {
    const pat = `%${q}%`;
    conds.push(
      or(
        like(auditLog.action, pat),
        like(auditLog.entity, pat),
        like(auditLog.entityId, pat),
        like(auditLog.before, pat),
        like(auditLog.after, pat),
        like(auditLog.meta, pat),
      )!,
    );
  }
  const whereClause = conds.length > 0 ? and(...conds) : undefined;

  const [countRow] = await db
    .select({ n: sql<number>`count(*)` })
    .from(auditLog)
    .where(whereClause);
  const total = countRow?.n ?? 0;
  const { page, totalPages, offset } = getPagination({ total, limit, page: pageParam });

  const rows = await db
    .select({
      id: auditLog.id,
      action: auditLog.action,
      entity: auditLog.entity,
      entityId: auditLog.entityId,
      before: auditLog.before,
      after: auditLog.after,
      meta: auditLog.meta,
      createdAt: auditLog.createdAt,
      actorName: userTable.name,
      actorRole: userTable.role,
    })
    .from(auditLog)
    .leftJoin(userTable, eq(auditLog.actorUserId, userTable.id))
    .where(whereClause)
    .orderBy(desc(auditLog.createdAt))
    .limit(limit)
    .offset(offset);

  // Distinct entities + actions untuk dropdown filter
  const entitiesRows = await db
    .selectDistinct({ entity: auditLog.entity })
    .from(auditLog)
    .orderBy(auditLog.entity);
  const entities = entitiesRows.map((r) => r.entity);

  return (
    <div className="p-4 md:p-6 max-w-6xl space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <PageHeader
          title="Audit Log"
          description="Riwayat aksi sensitif (delete, void, edit harga, adjust manual). Append-only — tidak bisa diedit."
        />
        <PageSizeSelect value={limit} />
      </div>

      <DateRangeFilter
        active={range.key}
        customFrom={range.from}
        customTo={range.to}
        basePath="/admin/audit-log"
      />

      <form className="flex gap-2 items-center flex-wrap bg-surface border border-line rounded-2xl p-3">
        {range.key && <input type="hidden" name="range" value={range.key} />}
        {sp.from && <input type="hidden" name="from" value={sp.from} />}
        {sp.to && <input type="hidden" name="to" value={sp.to} />}
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Cari action / entity / data..."
          className="flex-1 min-w-[200px] px-3 py-2 border border-line rounded-md text-sm"
        />
        <select
          name="entity"
          defaultValue={entityFilter}
          className="px-3 py-2 border border-line rounded-md text-sm"
        >
          <option value="">Semua Entity</option>
          {entities.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
        <input
          name="action"
          defaultValue={actionFilter}
          placeholder="Filter action..."
          className="px-3 py-2 border border-line rounded-md text-sm w-[160px]"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-brand-600 text-white rounded-md text-sm font-bold"
        >
          Cari
        </button>
        {(q || entityFilter || actionFilter) && (
          <a
            href="/admin/audit-log"
            className="px-3 py-2 text-sm text-[color:var(--muted)] hover:text-ink"
          >
            Reset
          </a>
        )}
      </form>

      <div className="bg-surface border border-line rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[color:var(--surface2)] text-[color:var(--muted)] text-left text-xs">
              <tr>
                <th className="p-3">Waktu</th>
                <th className="p-3">Aktor</th>
                <th className="p-3">Action</th>
                <th className="p-3">Entity</th>
                <th className="p-3">ID</th>
                <th className="p-3">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.id} className="align-top">
                  <td className="p-3 text-xs whitespace-nowrap">
                    {r.createdAt.toLocaleString("id-ID", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="p-3 text-xs">
                    <div className="font-bold">{r.actorName ?? "—"}</div>
                    <div className="text-[10px] text-[color:var(--muted)] uppercase">
                      {r.actorRole ?? "—"}
                    </div>
                  </td>
                  <td className="p-3 text-xs font-mono">
                    <span className="px-1.5 py-0.5 rounded bg-[color:var(--surface2)] font-bold">
                      {r.action}
                    </span>
                  </td>
                  <td className="p-3 text-xs font-mono">{r.entity}</td>
                  <td className="p-3 text-xs font-mono text-[color:var(--muted)]">
                    {r.entityId ?? "—"}
                  </td>
                  <td className="p-3 text-xs max-w-md">
                    {r.meta && (
                      <details className="text-[10px]">
                        <summary className="cursor-pointer text-brand">meta</summary>
                        <pre className="whitespace-pre-wrap break-all bg-[color:var(--surface2)] p-2 rounded mt-1">
                          {formatJson(r.meta)}
                        </pre>
                      </details>
                    )}
                    {r.before && (
                      <details className="text-[10px] mt-1">
                        <summary className="cursor-pointer text-amber-700">before</summary>
                        <pre className="whitespace-pre-wrap break-all bg-amber-50 p-2 rounded mt-1">
                          {formatJson(r.before)}
                        </pre>
                      </details>
                    )}
                    {r.after && (
                      <details className="text-[10px] mt-1">
                        <summary className="cursor-pointer text-emerald-700">after</summary>
                        <pre className="whitespace-pre-wrap break-all bg-emerald-50 p-2 rounded mt-1">
                          {formatJson(r.after)}
                        </pre>
                      </details>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-[color:var(--muted)]">
                    Belum ada audit log untuk filter ini.
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

function formatJson(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}
