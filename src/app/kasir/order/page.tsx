import { db } from "@/db";
import { eq, desc, gte, or, ne, and, inArray } from "drizzle-orm";
import { orderHeader } from "@/db/schema/order";
import { pelanggan } from "@/db/schema/pelanggan";
import { user as userTable } from "@/db/schema/auth";
import { PageHeader } from "@/components/AppShell";
import { OrderClient, type OrderRow } from "./OrderClient";

export const dynamic = "force-dynamic";

export default async function OrderKasirPage() {
  // Tampilkan: semua order belum-selesai + order selesai 48 jam terakhir (untuk lihat bukti antar)
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
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
      buktiFotoUrl: orderHeader.buktiFotoUrl,
      buktiJemputUrl: orderHeader.buktiJemputUrl,
      tipePengantaran: orderHeader.tipePengantaran,
      diantarAt: orderHeader.diantarAt,
      kurirUserId: orderHeader.kurirUserId,
      pelangganNama: pelanggan.nama,
      pelangganTelp: pelanggan.telp,
    })
    .from(orderHeader)
    .leftJoin(pelanggan, eq(orderHeader.pelangganId, pelanggan.id))
    .where(
      or(
        ne(orderHeader.status, "selesai"),
        and(eq(orderHeader.status, "selesai"), gte(orderHeader.diantarAt, cutoff)),
      ),
    )
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
        diantarAt: o.diantarAt?.toISOString() ?? null,
        items: itemDetail,
      };
    }),
  );

  const kurirList = await db
    .select({ id: userTable.id, name: userTable.name })
    .from(userTable)
    .where(inArray(userTable.role, ["kurir", "admin", "kasir"]));

  return (
    <div className="p-6">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <PageHeader title="Order Antar" description="Kelola order pengantaran yang masuk." />
        <a
          href="/kasir/order/baru"
          className="px-3 py-2 bg-brand-600 text-white rounded-md text-sm inline-flex items-center gap-1"
        >
          + Order Baru (Walk-in)
        </a>
      </div>
      <OrderClient rows={rows} kurirList={kurirList} />
    </div>
  );
}
