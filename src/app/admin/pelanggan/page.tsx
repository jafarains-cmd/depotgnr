import { db } from "@/db";
import { PageHeader } from "@/components/AppShell";
import { PelangganTable } from "./PelangganTable";

export const dynamic = "force-dynamic";

export default async function PelangganPage() {
  const list = await db.query.pelanggan.findMany({
    orderBy: (p, { desc }) => [desc(p.createdAt)],
  });
  return (
    <div className="p-6">
      <PageHeader title="Pelanggan" description="Data pelanggan walk-in dan langganan." />
      <PelangganTable rows={list} />
    </div>
  );
}
