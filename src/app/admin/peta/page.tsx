import { sql, eq, isNotNull, isNull, and } from "drizzle-orm";
import { db } from "@/db";
import { pelanggan } from "@/db/schema/pelanggan";
import { transaksi } from "@/db/schema/transaksi";
import { orderHeader } from "@/db/schema/order";
import { PageHeader } from "@/components/AppShell";
import { PetaClient, type PelangganGeo } from "./PetaClient";

export const dynamic = "force-dynamic";

export default async function PetaPage() {
  // Pelanggan dengan koordinat
  const list = await db
    .select()
    .from(pelanggan)
    .where(and(isNotNull(pelanggan.koordinatLat), isNotNull(pelanggan.koordinatLng)));

  // Ringkasan transaksi per pelanggan
  const trxSummary = await db
    .select({
      pelangganId: transaksi.pelangganId,
      total: sql<number>`coalesce(sum(${transaksi.total}), 0)`,
      jumlah: sql<number>`count(*)`,
    })
    .from(transaksi)
    .where(and(isNotNull(transaksi.pelangganId), isNull(transaksi.voidedAt)))
    .groupBy(transaksi.pelangganId);

  const trxMap = new Map(
    trxSummary.map((r) => [r.pelangganId!, { total: r.total, jumlah: r.jumlah }]),
  );

  // Ringkasan order per pelanggan
  const orderSummary = await db
    .select({
      pelangganId: orderHeader.pelangganId,
      jumlah: sql<number>`count(*)`,
      pending: sql<number>`sum(case when ${orderHeader.status} != 'selesai' and ${orderHeader.status} != 'batal' then 1 else 0 end)`,
    })
    .from(orderHeader)
    .where(isNotNull(orderHeader.pelangganId))
    .groupBy(orderHeader.pelangganId);

  const orderMap = new Map(
    orderSummary.map((r) => [r.pelangganId!, { jumlah: r.jumlah, pending: r.pending }]),
  );

  const data: PelangganGeo[] = list.map((p) => {
    const trx = trxMap.get(p.id);
    const ord = orderMap.get(p.id);
    return {
      id: p.id,
      nama: p.nama,
      telp: p.telp,
      alamat: p.alamat,
      tipe: p.tipe,
      lat: p.koordinatLat!,
      lng: p.koordinatLng!,
      totalBelanja: trx?.total ?? 0,
      jumlahTransaksi: trx?.jumlah ?? 0,
      jumlahOrder: ord?.jumlah ?? 0,
      orderPending: ord?.pending ?? 0,
    };
  });

  // Total semua pelanggan (termasuk yang belum punya koordinat) untuk info
  const [totalPelanggan] = await db
    .select({ count: sql<number>`count(*)` })
    .from(pelanggan);

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title="Peta Pelanggan"
        description={`${data.length} dari ${totalPelanggan.count} pelanggan punya koordinat. Klik marker untuk detail.`}
      />
      <div className="bg-surface rounded-xl border border-line overflow-hidden h-[calc(100vh-200px)]">
        <PetaClient pelanggan={data} />
      </div>
      {data.length === 0 && (
        <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-800">
          Belum ada pelanggan dengan koordinat. Edit pelanggan di{" "}
          <a href="/admin/pelanggan" className="underline">
            /admin/pelanggan
          </a>{" "}
          dan klik tombol "Pilih di Peta" untuk set koordinat.
        </div>
      )}
    </div>
  );
}

// Suppress unused warning untuk kolom yang ada di select
void eq;
