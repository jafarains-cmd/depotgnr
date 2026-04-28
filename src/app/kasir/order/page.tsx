import { db } from "@/db";
import { eq, desc, ne } from "drizzle-orm";
import { orderHeader } from "@/db/schema/order";
import { pelanggan } from "@/db/schema/pelanggan";
import { PageHeader } from "@/components/AppShell";
import { OrderClient, type OrderRow } from "./OrderClient";

export const dynamic = "force-dynamic";

export default async function OrderKasirPage() {
  const aktif = await db
    .select({
      id: orderHeader.id,
      nomorOrder: orderHeader.nomorOrder,
      sumber: orderHeader.sumber,
      status: orderHeader.status,
      alamatAntar: orderHeader.alamatAntar,
      jadwalAntar: orderHeader.jadwalAntar,
      totalEstimasi: orderHeader.totalEstimasi,
      catatan: orderHeader.catatan,
      createdAt: orderHeader.createdAt,
      pelangganNama: pelanggan.nama,
      pelangganTelp: pelanggan.telp,
    })
    .from(orderHeader)
    .leftJoin(pelanggan, eq(orderHeader.pelangganId, pelanggan.id))
    .where(ne(orderHeader.status, "selesai"))
    .orderBy(desc(orderHeader.createdAt));

  const rows: OrderRow[] = await Promise.all(
    aktif.map(async (o) => {
      const items = await db.query.orderItem.findMany({
        where: (oi, { eq }) => eq(oi.orderId, o.id),
        with: { },
      });
      const itemDetail = await Promise.all(
        items.map(async (it) => {
          const p = await db.query.produk.findFirst({
            where: (pp, { eq }) => eq(pp.id, it.produkId),
          });
          return {
            qty: it.qty,
            jenis: it.jenis,
            namaProduk: p?.nama ?? `#${it.produkId}`,
          };
        }),
      );
      return {
        ...o,
        jadwalAntar: o.jadwalAntar?.toISOString() ?? null,
        createdAt: o.createdAt.toISOString(),
        items: itemDetail,
      };
    }),
  );

  return (
    <div className="p-6">
      <PageHeader title="Order Antar" description="Kelola order pengantaran yang masuk." />
      <OrderClient rows={rows} />
    </div>
  );
}
