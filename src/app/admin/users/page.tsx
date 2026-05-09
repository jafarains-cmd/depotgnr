import { db } from "@/db";
import { PageHeader } from "@/components/AppShell";
import { UsersClient } from "./UsersClient";
import { PageSizeSelect } from "@/components/PageSizeSelect";
import { parseLimit } from "@/lib/page-size";

export const dynamic = "force-dynamic";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ limit?: string }>;
}) {
  const sp = await searchParams;
  const limit = parseLimit(sp.limit);
  const list = await db.query.user.findMany({
    orderBy: (u, { desc }) => [desc(u.createdAt)],
    limit,
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
    </div>
  );
}
