import { eq } from "drizzle-orm";
import { db } from "@/db";
import { produk } from "@/db/schema/produk";
import { requireSession } from "@/lib/permissions";
import { getOrCreatePelanggan } from "@/lib/pelanggan";
import { OrderForm } from "./OrderForm";

export const dynamic = "force-dynamic";

export default async function OrderBaruPage() {
  const session = await requireSession();
  const pel = await getOrCreatePelanggan(session.user.id, session.user.name);
  const produkList = await db.query.produk.findMany({
    where: eq(produk.aktif, true),
    orderBy: (p, { asc }) => [asc(p.id)],
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Order Baru</h1>
        <p className="text-sm text-[color:var(--muted)]">Pilih produk, alamat antar, lalu kirim.</p>
      </div>
      <OrderForm
        produkList={produkList}
        defaultAlamat={pel.alamat ?? ""}
      />
    </div>
  );
}
