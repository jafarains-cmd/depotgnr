import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { pelanggan } from "@/db/schema/pelanggan";
import { requireRole } from "@/lib/permissions";
import { PageHeader } from "@/components/AppShell";
import { PendingList } from "@/app/admin/langganan-pending/PendingList";

export const dynamic = "force-dynamic";

export default async function KasirLanggananPendingPage() {
  await requireRole(["admin", "kasir"]);
  const rows = await db
    .select({
      id: pelanggan.id,
      nama: pelanggan.nama,
      telp: pelanggan.telp,
      alamat: pelanggan.alamat,
      ktpFotoUrl: pelanggan.ktpFotoUrl,
      ktpUploadedAt: pelanggan.ktpUploadedAt,
    })
    .from(pelanggan)
    .where(eq(pelanggan.tipe, "langganan_pending"))
    .orderBy(desc(pelanggan.ktpUploadedAt));

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title="Verifikasi Langganan"
        description={`${rows.length} pelanggan menunggu verifikasi (view-only untuk kasir — verify harus lewat admin).`}
      />
      <PendingList rows={rows} canVerify={false} />
    </div>
  );
}
