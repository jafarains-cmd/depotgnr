import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { produk } from "@/db/schema/produk";
import { orderHeader, orderItem } from "@/db/schema/order";
import { requireSession } from "@/lib/permissions";
import { getOrCreatePelanggan } from "@/lib/pelanggan";
import { OrderForm } from "./OrderForm";

export const dynamic = "force-dynamic";

type Jenis = "isi_ulang" | "tukar" | "beli_baru";

export default async function OrderBaruPage({
  searchParams,
}: {
  searchParams: Promise<{ clone?: string }>;
}) {
  const session = await requireSession();
  const pel = await getOrCreatePelanggan(session.user.id, session.user.name);
  const produkList = await db.query.produk.findMany({
    where: eq(produk.aktif, true),
    orderBy: (p, { asc }) => [asc(p.id)],
  });

  // Quick reorder: clone item dari order lama (wajib milik pelanggan ini)
  const sp = await searchParams;
  const cloneId = sp.clone ? Number(sp.clone) : null;
  let prefillItems: { produkId: number; jenis: Jenis; qty: number }[] | undefined;
  let cloneNote: string | null = null;
  if (cloneId) {
    const o = await db.query.orderHeader.findFirst({
      where: and(eq(orderHeader.id, cloneId), eq(orderHeader.pelangganId, pel.id)),
    });
    if (o) {
      const items = await db
        .select({ produkId: orderItem.produkId, jenis: orderItem.jenis, qty: orderItem.qty })
        .from(orderItem)
        .where(eq(orderItem.orderId, cloneId));
      prefillItems = items.map((it) => ({
        produkId: it.produkId,
        jenis: it.jenis as Jenis,
        qty: it.qty,
      }));
      cloneNote = o.nomorOrder;
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Order Baru</h1>
        <p className="text-sm text-[color:var(--muted)]">Pilih produk, alamat antar, lalu kirim.</p>
      </div>
      <OrderForm
        produkList={produkList}
        defaultAlamat={pel.alamat ?? ""}
        prefillItems={prefillItems}
        cloneNote={cloneNote}
        saldoLoyalti={pel.saldoLoyalti}
      />
    </div>
  );
}
