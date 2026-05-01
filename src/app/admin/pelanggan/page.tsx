import { db } from "@/db";
import { PageHeader } from "@/components/AppShell";
import { PelangganTable } from "./PelangganTable";

export const dynamic = "force-dynamic";

export default async function PelangganPage() {
  // Pagination: limit 200. Untuk skala besar, tambah search/cursor.
  const list = await db.query.pelanggan.findMany({
    orderBy: (p, { desc }) => [desc(p.createdAt)],
    limit: 200,
  });
  return (
    <div className="p-6">
      <PageHeader title="Pelanggan" description="Data pelanggan walk-in dan langganan." />
      <PelangganTable rows={list} />
    </div>
  );
}
