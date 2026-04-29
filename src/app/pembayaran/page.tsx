import { eq, desc, inArray } from "drizzle-orm";
import { db } from "@/db";
import { orderHeader } from "@/db/schema/order";
import { pelanggan as pelangganTable } from "@/db/schema/pelanggan";
import { requireRole } from "@/lib/permissions";
import { PembayaranClient, type Row } from "./PembayaranClient";

export const dynamic = "force-dynamic";

export default async function PembayaranPage() {
  await requireRole(["admin", "kasir"]);

  const list = await db
    .select({
      id: orderHeader.id,
      nomorOrder: orderHeader.nomorOrder,
      totalEstimasi: orderHeader.totalEstimasi,
      metodeBayar: orderHeader.metodeBayar,
      statusBayar: orderHeader.statusBayar,
      buktiBayarUrl: orderHeader.buktiBayarUrl,
      bayarAt: orderHeader.bayarAt,
      createdAt: orderHeader.createdAt,
      pelangganNama: pelangganTable.nama,
      pelangganTelp: pelangganTable.telp,
    })
    .from(orderHeader)
    .leftJoin(pelangganTable, eq(orderHeader.pelangganId, pelangganTable.id))
    .where(inArray(orderHeader.statusBayar, ["menunggu", "lunas"]))
    .orderBy(desc(orderHeader.updatedAt))
    .limit(100);

  const rows: Row[] = list.map((r) => ({
    id: r.id,
    nomorOrder: r.nomorOrder,
    total: r.totalEstimasi,
    metode: r.metodeBayar,
    status: r.statusBayar,
    buktiUrl: r.buktiBayarUrl,
    bayarAt: r.bayarAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    pelangganNama: r.pelangganNama,
    pelangganTelp: r.pelangganTelp,
  }));

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-xl font-bold">Konfirmasi Pembayaran</h1>
        <p className="text-sm text-slate-500">
          Review bukti pembayaran online dari pelanggan & konfirmasi setelah cocok dengan mutasi.
        </p>
      </div>
      <PembayaranClient rows={rows} />
    </div>
  );
}
