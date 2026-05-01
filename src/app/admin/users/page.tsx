import { db } from "@/db";
import { PageHeader } from "@/components/AppShell";
import { UsersClient } from "./UsersClient";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  // Pagination: limit 100. Untuk skala lebih besar, tambah search/cursor pagination.
  const list = await db.query.user.findMany({
    orderBy: (u, { desc }) => [desc(u.createdAt)],
    limit: 100,
  });

  return (
    <div className="p-6">
      <PageHeader title="User" description="Kelola admin, kasir, dan pelanggan." />
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
