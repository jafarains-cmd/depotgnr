import Link from "next/link";
import { eq, and, desc, ne } from "drizzle-orm";
import { db } from "@/db";
import { orderHeader } from "@/db/schema/order";
import { produk } from "@/db/schema/produk";
import { requireSession } from "@/lib/permissions";
import { getOrCreatePelanggan } from "@/lib/pelanggan";
import { formatRupiah } from "@/lib/utils";
import { Plus, Truck, History } from "lucide-react";
import { CancelOrderButton } from "../order-baru/CancelOrderButton";

export const dynamic = "force-dynamic";

export default async function BerandaPage() {
  const session = await requireSession();
  const me = await getOrCreatePelanggan(session.user.id, session.user.name);

  const aktif = await db
    .select()
    .from(orderHeader)
    .where(and(eq(orderHeader.pelangganId, me.id), ne(orderHeader.status, "selesai")))
    .orderBy(desc(orderHeader.createdAt))
    .limit(5);

  const produkAktif = await db.query.produk.findMany({
    where: eq(produk.aktif, true),
    orderBy: (p, { asc }) => [asc(p.id)],
    limit: 4,
  });

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-br from-brand-600 to-brand-700 text-white rounded-2xl p-5">
        <div className="text-sm opacity-80">Selamat datang</div>
        <div className="text-xl font-bold">{me.nama}</div>
        <p className="text-sm opacity-90 mt-2">
          Pesan air minum jadi lebih mudah. Order sekarang dan kami antar ke rumah.
        </p>
        <Link
          href="/pelanggan/order-baru"
          className="mt-3 inline-flex items-center gap-1.5 bg-white text-brand-700 font-medium px-4 py-2 rounded-md text-sm"
        >
          <Plus size={16} /> Order Baru
        </Link>
      </div>

      <section>
        <div className="flex justify-between items-center mb-2">
          <h2 className="font-semibold text-slate-800 inline-flex items-center gap-1.5">
            <Truck size={16} /> Order Berjalan
          </h2>
          <Link href="/pelanggan/riwayat" className="text-xs text-brand-600">
            Lihat semua
          </Link>
        </div>
        {aktif.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-5 text-sm text-slate-400 text-center">
            Belum ada order aktif.
          </div>
        ) : (
          <div className="space-y-2">
            {aktif.map((o) => (
              <div
                key={o.id}
                className="bg-white border border-slate-200 rounded-xl p-4 flex justify-between items-start gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-slate-500 font-mono">{o.nomorOrder}</div>
                  <div className="text-sm font-medium capitalize">{o.status}</div>
                  <div className="text-xs text-slate-500">
                    {o.createdAt.toLocaleString("id-ID")}
                  </div>
                  {o.status === "pending" && (
                    <div className="mt-2">
                      <CancelOrderButton orderId={o.id} nomorOrder={o.nomorOrder} />
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="font-semibold">{formatRupiah(o.totalEstimasi)}</div>
                  {o.status !== "pending" && (
                    <div className="text-xs text-slate-400 mt-1">tidak bisa dibatalkan</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="flex justify-between items-center mb-2">
          <h2 className="font-semibold text-slate-800">Produk Tersedia</h2>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {produkAktif.map((p) => (
            <div key={p.id} className="bg-white border border-slate-200 rounded-xl p-3">
              <div className="font-medium text-sm">{p.nama}</div>
              <div className="text-xs text-slate-500 mb-2">{p.deskripsi}</div>
              <div className="text-xs space-y-0.5">
                {p.hargaIsiUlang > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Isi Ulang</span>
                    <span>{formatRupiah(p.hargaIsiUlang)}</span>
                  </div>
                )}
                {p.hargaTukar > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Tukar</span>
                    <span>{formatRupiah(p.hargaTukar)}</span>
                  </div>
                )}
                {p.hargaBeliBaru > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Beli Baru</span>
                    <span>{formatRupiah(p.hargaBeliBaru)}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <Link
        href="/pelanggan/riwayat"
        className="flex items-center justify-center gap-1.5 py-3 text-sm text-slate-600 hover:text-brand-700"
      >
        <History size={14} /> Lihat riwayat order & transaksi
      </Link>
    </div>
  );
}
