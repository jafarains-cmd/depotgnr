import { db } from "@/db";
import { requireRole } from "@/lib/permissions";
import { PelangganTable } from "./PelangganTable";

export const dynamic = "force-dynamic";

export default async function PelangganDataPage() {
  const session = await requireRole(["admin", "kasir"]);
  // Pagination: limit 200. Untuk skala besar, tambah search/cursor.
  const list = await db.query.pelanggan.findMany({
    orderBy: (p, { desc }) => [desc(p.createdAt)],
    limit: 200,
  });
  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-bold">Data Pelanggan</h1>
        <p className="text-sm text-[color:var(--muted)]">
          Walk-in dan langganan. Edit lokasi, kontak, atau catatan.
        </p>
      </div>
      <PelangganTable rows={list} canDelete={session.user.role === "admin"} />
    </div>
  );
}
