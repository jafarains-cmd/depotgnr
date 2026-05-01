import { eq, desc, ne } from "drizzle-orm";
import { db } from "@/db";
import { orderHeader } from "@/db/schema/order";
import { pelanggan as pelangganTable } from "@/db/schema/pelanggan";
import { requireRole } from "@/lib/permissions";
import { PembayaranClient, type Row } from "./PembayaranClient";

export const dynamic = "force-dynamic";

export default async function PembayaranPage() {
  await requireRole(["admin", "kasir"]);

  // Ambil semua order non-batal (limit 500), lalu filter di JS untuk 3 kelompok:
  //  - menunggu (perlu verifikasi bukti)
  //  - lunas (history)
  //  - piutang: status=selesai + statusBayar=belum
  const list = await db
    .select({
      id: orderHeader.id,
      nomorOrder: orderHeader.nomorOrder,
      totalEstimasi: orderHeader.totalEstimasi,
      metodeBayar: orderHeader.metodeBayar,
      statusBayar: orderHeader.statusBayar,
      statusOrder: orderHeader.status,
      buktiBayarUrl: orderHeader.buktiBayarUrl,
      bayarAt: orderHeader.bayarAt,
      diantarAt: orderHeader.diantarAt,
      createdAt: orderHeader.createdAt,
      pelangganNama: pelangganTable.nama,
      pelangganTelp: pelangganTable.telp,
    })
    .from(orderHeader)
    .leftJoin(pelangganTable, eq(orderHeader.pelangganId, pelangganTable.id))
    .where(ne(orderHeader.status, "batal"))
    .orderBy(desc(orderHeader.updatedAt))
    .limit(500);

  const filtered = list.filter((r) => {
    if (r.statusBayar === "menunggu" || r.statusBayar === "lunas") return true;
    if (r.statusOrder === "selesai" && r.statusBayar === "belum") return true;
    return false;
  });

  const rows: Row[] = filtered.map((r) => ({
    id: r.id,
    nomorOrder: r.nomorOrder,
    total: r.totalEstimasi,
    metode: r.metodeBayar,
    status: r.statusBayar,
    statusOrder: r.statusOrder,
    buktiUrl: r.buktiBayarUrl,
    bayarAt: r.bayarAt?.toISOString() ?? null,
    diantarAt: r.diantarAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    pelangganNama: r.pelangganNama,
    pelangganTelp: r.pelangganTelp,
  }));

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-xl font-bold">Konfirmasi Pembayaran</h1>
        <p className="text-sm text-[color:var(--muted)]">
          Review bukti pembayaran, tandai lunas piutang, atau lihat history.
        </p>
      </div>
      <PembayaranClient rows={rows} />
    </div>
  );
}
