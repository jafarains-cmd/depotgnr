import { sql, like, or, eq } from "drizzle-orm";
import { db } from "@/db";
import { user as userTable, session as sessionTable } from "@/db/schema/auth";
import { PageHeader } from "@/components/AppShell";
import { UsersClient } from "./UsersClient";
import { PageSizeSelect } from "@/components/PageSizeSelect";
import { Pagination } from "@/components/Pagination";
import { parseLimit, parsePage, getPagination } from "@/lib/page-size";

export const dynamic = "force-dynamic";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ limit?: string; page?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const limit = parseLimit(sp.limit);
  const pageParam = parsePage(sp.page);
  const q = (sp.q ?? "").trim();
  const whereClause = q
    ? or(
        like(userTable.name, `%${q}%`),
        like(userTable.email, `%${q}%`),
        like(userTable.username, `%${q}%`),
        like(userTable.phoneNumber, `%${q}%`),
      )
    : undefined;

  const [countRow] = await db
    .select({ n: sql<number>`count(*)` })
    .from(userTable)
    .where(whereClause);
  const total = countRow?.n ?? 0;
  const { page, totalPages, offset } = getPagination({ total, limit, page: pageParam });

  const list = await db.query.user.findMany({
    where: whereClause,
    orderBy: (u, { desc }) => [desc(u.createdAt)],
    limit,
    offset,
  });

  // Login terakhir per user (max session.createdAt). Subquery aggregate
  // ke Map untuk lookup cepat di render.
  const lastLogins = await db
    .select({
      userId: sessionTable.userId,
      lastLogin: sql<number>`max(${sessionTable.createdAt})`,
      sessionCount: sql<number>`count(*)`,
    })
    .from(sessionTable)
    .groupBy(sessionTable.userId);
  const loginMap = new Map(
    lastLogins.map((r) => [
      r.userId,
      {
        lastLogin: r.lastLogin ? new Date(r.lastLogin * 1000) : null,
        sessionCount: r.sessionCount,
      },
    ]),
  );

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
        <PageHeader title="User" description="Kelola admin, kasir, dan pelanggan." />
        <PageSizeSelect value={limit} />
      </div>
      <form className="flex gap-2 items-center mb-4">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Cari nama / email / username / telp..."
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
            href="/admin/users"
            className="px-3 py-2 text-sm text-[color:var(--muted)] hover:text-ink"
          >
            Reset
          </a>
        )}
      </form>
      <UsersClient
        users={list.map((u) => {
          const log = loginMap.get(u.id);
          return {
            id: u.id,
            name: u.name,
            email: u.email,
            username: u.username,
            phoneNumber: u.phoneNumber,
            role: u.role,
            banned: !!u.banned,
            lastLogin: log?.lastLogin?.toISOString() ?? null,
            sessionCount: log?.sessionCount ?? 0,
          };
        })}
      />
      <Pagination page={page} totalPages={totalPages} total={total} />
    </div>
  );
}
