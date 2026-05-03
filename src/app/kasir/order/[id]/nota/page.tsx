import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { orderHeader, orderItem } from "@/db/schema/order";
import { produk } from "@/db/schema/produk";
import { pelanggan as pelangganTable } from "@/db/schema/pelanggan";
import { requireRole } from "@/lib/permissions";
import { NotaPaper } from "@/components/NotaPaper";
import { NotaKasirActions } from "./NotaKasirActions";

export const dynamic = "force-dynamic";

export default async function NotaKasirPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["admin", "kasir"]);
  const { id } = await params;
  const orderId = Number(id);
  if (!orderId) notFound();

  const o = await db.query.orderHeader.findFirst({ where: eq(orderHeader.id, orderId) });
  if (!o) notFound();

  const pel = o.pelangganId
    ? await db.query.pelanggan.findFirst({ where: eq(pelangganTable.id, o.pelangganId) })
    : null;

  const items = await db
    .select({
      qty: orderItem.qty,
      hargaEstimasi: orderItem.hargaEstimasi,
      jenis: orderItem.jenis,
      namaProduk: produk.nama,
    })
    .from(orderItem)
    .leftJoin(produk, eq(orderItem.produkId, produk.id))
    .where(eq(orderItem.orderId, orderId));

  const cfgRows = await db.query.pengaturan.findMany();
  const cfg = Object.fromEntries(cfgRows.map((r) => [r.key, r.value ?? ""]));

  const subtotal = items.reduce((s, it) => s + (it.hargaEstimasi ?? 0) * it.qty, 0);

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .nota-paper { box-shadow: none !important; border: none !important; }
        }
      `}</style>
      <div className="min-h-screen py-4 print:py-0">
        <div className="max-w-md mx-auto">
          <div className="no-print mb-4">
            <NotaKasirActions />
          </div>

          <NotaPaper
            header={{
              namaDepot: cfg.namaDepot || "Depot Air Minum",
              alamatDepot: cfg.alamatDepot,
              telpDepot: cfg.telpDepot,
            }}
            meta={{
              nomor: o.nomorOrder,
              tanggal: o.createdAt,
              pelangganNama: pel?.nama ?? "Walk-in",
            }}
            items={items.map((it) => ({
              namaProduk: it.namaProduk ?? "-",
              qty: it.qty,
              hargaSatuan: it.hargaEstimasi ?? 0,
              subtotal: (it.hargaEstimasi ?? 0) * it.qty,
              jenis: it.jenis,
            }))}
            totals={{
              subtotal,
              loyalti: o.loyaltiDipakai,
              total: o.totalEstimasi - o.loyaltiDipakai,
              metodeBayar: o.metodeBayar,
              statusBayar: o.statusBayar,
              statusOrder: o.status,
            }}
            catatan={o.catatan}
            footer={cfg.footerNota || undefined}
          />
        </div>
      </div>
    </>
  );
}
