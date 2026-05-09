import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { bahanBaku, mutasiBahanBaku } from "@/db/schema/bahan-baku";
import { user as userTable } from "@/db/schema/auth";
import { PageHeader } from "@/components/AppShell";
import { requireRole } from "@/lib/permissions";
import { BahanBakuClient } from "./BahanBakuClient";

export const dynamic = "force-dynamic";

export default async function BahanBakuPage() {
  await requireRole(["admin"]);

  const items = await db.query.bahanBaku.findMany({
    orderBy: (b, { asc }) => [asc(b.aktif), asc(b.id)],
  });

  const recentMutasi = await db
    .select({
      id: mutasiBahanBaku.id,
      bahanId: mutasiBahanBaku.bahanId,
      bahanNama: bahanBaku.nama,
      satuan: bahanBaku.satuan,
      perubahan: mutasiBahanBaku.perubahan,
      alasan: mutasiBahanBaku.alasan,
      biaya: mutasiBahanBaku.biaya,
      catatan: mutasiBahanBaku.catatan,
      createdAt: mutasiBahanBaku.createdAt,
      userName: userTable.name,
    })
    .from(mutasiBahanBaku)
    .leftJoin(bahanBaku, eq(mutasiBahanBaku.bahanId, bahanBaku.id))
    .leftJoin(userTable, eq(mutasiBahanBaku.userId, userTable.id))
    .orderBy(desc(mutasiBahanBaku.createdAt))
    .limit(50);

  return (
    <div className="p-4 md:p-6 max-w-5xl space-y-4">
      <PageHeader
        title="Stok Bahan Baku"
        description="Track tutup galon, segel, label, plastik wrap, dll. Alert kalau stok menipis."
      />

      <BahanBakuClient
        items={items.map((i) => ({
          id: i.id,
          nama: i.nama,
          satuan: i.satuan,
          stok: i.stok,
          threshold: i.threshold,
          hargaSatuan: i.hargaSatuan,
          aktif: i.aktif,
          catatan: i.catatan,
        }))}
        recentMutasi={recentMutasi.map((m) => ({
          id: m.id,
          bahanId: m.bahanId,
          bahanNama: m.bahanNama ?? "—",
          satuan: m.satuan ?? "pcs",
          perubahan: m.perubahan,
          alasan: m.alasan,
          biaya: m.biaya,
          catatan: m.catatan,
          createdAt: m.createdAt.toISOString(),
          userName: m.userName,
        }))}
      />
    </div>
  );
}
