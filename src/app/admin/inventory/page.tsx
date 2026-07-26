import { eq, desc, sql } from "drizzle-orm";
import { db } from "@/db";
import { stokGalon, mutasiStok } from "@/db/schema/inventory";
import { produk } from "@/db/schema/produk";
import { user as userTable } from "@/db/schema/auth";
import { PageHeader } from "@/components/AppShell";
import { InventoryClient } from "./InventoryClient";
import { PageSizeSelect } from "@/components/PageSizeSelect";
import { Pagination } from "@/components/Pagination";
import { parseLimit, parsePage, getPagination } from "@/lib/page-size";

export const dynamic = "force-dynamic";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ limit?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const limit = parseLimit(sp.limit);
  const pageParam = parsePage(sp.page);

  const [countRow] = await db.select({ n: sql<number>`count(*)` }).from(mutasiStok);
  const total = countRow?.n ?? 0;
  const { page, totalPages, offset } = getPagination({ total, limit, page: pageParam });
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
    .limit(limit)
    .offset(offset);

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
        <PageHeader title="Inventory" description="Stok galon dan mutasi stok." />
        <div className="flex gap-2 items-center">
          <a
            href="/admin/inventory/pembelian"
            className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 transition inline-flex items-center gap-1.5"
          >
            + Beli Galon
          </a>
          <PageSizeSelect value={limit} />
        </div>
      </div>
      <InventoryClient
        produk={produkList.map((p) => ({
          id: p.id,
          nama: p.nama,
          terisi: stokMap.get(`${p.id}:terisi`) ?? 0,
          kosong: stokMap.get(`${p.id}:kosong`) ?? 0,
          rusak: stokMap.get(`${p.id}:rusak`) ?? 0,
          stokMinimal: p.stokMinimal ?? 0,
        }))}
        mutasi={mutasi.map((m) => ({
          ...m,
          createdAt: m.createdAt.toISOString(),
        }))}
      />
      <Pagination page={page} totalPages={totalPages} total={total} />
    </div>
  );
}
