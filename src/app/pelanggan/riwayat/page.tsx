import { eq, desc, inArray } from "drizzle-orm";
import { db } from "@/db";
import { orderHeader, orderItem } from "@/db/schema/order";
import { transaksi } from "@/db/schema/transaksi";
import { produk } from "@/db/schema/produk";
import { requireSession } from "@/lib/permissions";
import { getOrCreatePelanggan } from "@/lib/pelanggan";
import { formatRupiah } from "@/lib/utils";
import { CancelOrderButton } from "../order-baru/CancelOrderButton";

export const dynamic = "force-dynamic";

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  diproses: "bg-blue-100 text-blue-700",
  diantar: "bg-purple-100 text-purple-700",
  selesai: "bg-emerald-100 text-emerald-700",
  batal: "bg-slate-200 text-slate-600",
};

export default async function RiwayatPage() {
  const session = await requireSession();
  const me = await getOrCreatePelanggan(session.user.id, session.user.name);

  const orders = await db
    .select()
    .from(orderHeader)
    .where(eq(orderHeader.pelangganId, me.id))
    .orderBy(desc(orderHeader.createdAt))
    .limit(50);

  const orderIds = orders.map((o) => o.id);
  const allItems = orderIds.length
    ? await db
        .select({
          orderId: orderItem.orderId,
          qty: orderItem.qty,
          jenis: orderItem.jenis,
          namaProduk: produk.nama,
        })
        .from(orderItem)
        .leftJoin(produk, eq(orderItem.produkId, produk.id))
        .where(inArray(orderItem.orderId, orderIds))
    : [];

  const itemsByOrder = new Map<number, typeof allItems>();
  for (const it of allItems) {
    const arr = itemsByOrder.get(it.orderId) ?? [];
    arr.push(it);
    itemsByOrder.set(it.orderId, arr);
  }

  const trxList = await db
    .select()
    .from(transaksi)
    .where(eq(transaksi.pelangganId, me.id))
    .orderBy(desc(transaksi.createdAt))
    .limit(50);

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-xl font-bold mb-3">Riwayat Order</h1>
        {orders.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-slate-400 text-sm">
            Belum ada order.
          </div>
        )}
        <div className="space-y-2">
          {orders.map((o) => {
            const its = itemsByOrder.get(o.id) ?? [];
            return (
              <div key={o.id} className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-mono text-xs text-slate-500">{o.nomorOrder}</div>
                    <div className="text-xs text-slate-500">
                      {o.createdAt.toLocaleString("id-ID")}
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      STATUS_COLOR[o.status] ?? "bg-slate-100"
                    }`}
                  >
                    {o.status}
                  </span>
                </div>
                <ul className="text-sm space-y-0.5 mb-2">
                  {its.map((it, i) => (
                    <li key={i}>
                      • {it.qty}× {it.namaProduk ?? "?"}{" "}
                      <span className="text-xs text-slate-500">({it.jenis})</span>
                    </li>
                  ))}
                </ul>
                {o.alamatAntar && (
                  <div className="text-xs text-slate-500">📍 {o.alamatAntar}</div>
                )}
                <div className="flex justify-between items-center mt-2">
                  <div className="text-sm font-medium">
                    Estimasi: {formatRupiah(o.totalEstimasi)}
                  </div>
                  {o.status === "pending" && (
                    <CancelOrderButton orderId={o.id} nomorOrder={o.nomorOrder} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-3">Riwayat Transaksi</h2>
        {trxList.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-slate-400 text-sm">
            Belum ada transaksi.
          </div>
        )}
        <div className="space-y-2">
          {trxList.map((t) => (
            <div
              key={t.id}
              className="bg-white border border-slate-200 rounded-xl p-3 flex justify-between"
            >
              <div>
                <div className="font-mono text-xs text-slate-500">{t.nomorNota}</div>
                <div className="text-xs text-slate-500">
                  {t.createdAt.toLocaleString("id-ID")} · {t.metodeBayar.toUpperCase()}
                </div>
              </div>
              <div className="text-right font-medium">{formatRupiah(t.total)}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
