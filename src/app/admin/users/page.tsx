import { sql } from "drizzle-orm";
import { db } from "@/db";
import { user as userTable } from "@/db/schema/auth";
import { PageHeader } from "@/components/AppShell";
import { UsersClient } from "./UsersClient";
import { PageSizeSelect } from "@/components/PageSizeSelect";
import { Pagination } from "@/components/Pagination";
import { parseLimit, parsePage, getPagination } from "@/lib/page-size";

export const dynamic = "force-dynamic";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ limit?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const limit = parseLimit(sp.limit);
  const pageParam = parsePage(sp.page);

  const [countRow] = await db.select({ n: sql<number>`count(*)` }).from(userTable);
  const total = countRow?.n ?? 0;
  const { page, totalPages, offset } = getPagination({ total, limit, page: pageParam });

  const list = await db.query.user.findMany({
    orderBy: (u, { desc }) => [desc(u.createdAt)],
    limit,
    offset,
  });

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
        <PageHeader title="User" description="Kelola admin, kasir, dan pelanggan." />
        <PageSizeSelect value={limit} />
      </div>
      <UsersClient
        users={list.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          username: u.username,
          phoneNumber: u.phoneNumber,
          role: u.role,
          banned: !!u.banned,
        }))}
      />
      <Pagination page={page} totalPages={totalPages} total={total} />
    </div>
  );
}
