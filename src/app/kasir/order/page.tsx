import { db } from "@/db";
import { eq, desc, gte, or, ne, and, inArray } from "drizzle-orm";
import { orderHeader, orderItem } from "@/db/schema/order";
import { pelanggan } from "@/db/schema/pelanggan";
import { produk } from "@/db/schema/produk";
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

  // Single batch query untuk semua items + produk join (no N+1)
  const orderIds = aktif.map((o) => o.id);
  const allItems = orderIds.length
    ? await db
        .select({
          orderId: orderItem.orderId,
          qty: orderItem.qty,
          jenis: orderItem.jenis,
          produkId: orderItem.produkId,
          namaProduk: produk.nama,
        })
        .from(orderItem)
        .leftJoin(produk, eq(orderItem.produkId, produk.id))
        .where(inArray(orderItem.orderId, orderIds))
    : [];

  const itemsByOrder = new Map<number, { qty: number; jenis: string; namaProduk: string }[]>();
  for (const it of allItems) {
    const arr = itemsByOrder.get(it.orderId) ?? [];
    arr.push({
      qty: it.qty,
      jenis: it.jenis,
      namaProduk: it.namaProduk ?? `#${it.produkId}`,
    });
    itemsByOrder.set(it.orderId, arr);
  }

  const rows: OrderRow[] = aktif.map((o) => ({
    ...o,
    jadwalAntar: o.jadwalAntar?.toISOString() ?? null,
    createdAt: o.createdAt.toISOString(),
    diantarAt: o.diantarAt?.toISOString() ?? null,
    items: itemsByOrder.get(o.id) ?? [],
  }));

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
