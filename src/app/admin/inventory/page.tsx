import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { stokGalon, mutasiStok } from "@/db/schema/inventory";
import { produk } from "@/db/schema/produk";
import { user as userTable } from "@/db/schema/auth";
import { PageHeader } from "@/components/AppShell";
import { InventoryClient } from "./InventoryClient";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const produkList = await db.query.produk.findMany({
    orderBy: (p, { asc }) => [asc(p.id)],
  });

  const stokRows = await db
    .select({
      produkId: stokGalon.produkId,
      status: stokGalon.status,
      jumlah: stokGalon.jumlah,
    })
    .from(stokGalon);

  const stokMap = new Map<string, number>();
  for (const r of stokRows) {
    stokMap.set(`${r.produkId}:${r.status}`, r.jumlah);
  }

  const mutasi = await db
    .select({
      id: mutasiStok.id,
      produkId: mutasiStok.produkId,
      status: mutasiStok.status,
      perubahan: mutasiStok.perubahan,
      alasan: mutasiStok.alasan,
      createdAt: mutasiStok.createdAt,
      namaProduk: produk.nama,
      userName: userTable.name,
    })
    .from(mutasiStok)
    .leftJoin(produk, eq(mutasiStok.produkId, produk.id))
    .leftJoin(userTable, eq(mutasiStok.userId, userTable.id))
    .orderBy(desc(mutasiStok.createdAt))
    .limit(50);

  return (
    <div className="p-4 md:p-6">
      <PageHeader title="Inventory" description="Stok galon dan mutasi stok." />
      <InventoryClient
        produk={produkList.map((p) => ({
          id: p.id,
          nama: p.nama,
          terisi: stokMap.get(`${p.id}:terisi`) ?? 0,
          kosong: stokMap.get(`${p.id}:kosong`) ?? 0,
          rusak: stokMap.get(`${p.id}:rusak`) ?? 0,
        }))}
        mutasi={mutasi.map((m) => ({
          ...m,
          createdAt: m.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
