import { db } from "@/db";
import { eq } from "drizzle-orm";
import { produk } from "@/db/schema/produk";
import { PageHeader } from "@/components/AppShell";
import { requireRole } from "@/lib/permissions";
import { OrderBaruClient } from "./OrderBaruClient";

export const dynamic = "force-dynamic";

export default async function OrderBaruKasirPage() {
  await requireRole(["admin", "kasir"]);
  const produkList = await db.query.produk.findMany({
    where: eq(produk.aktif, true),
    orderBy: (p, { asc }) => [asc(p.id)],
  });

  return (
    <div className="p-6 max-w-3xl">
      <PageHeader
        title="Buat Order (Walk-in)"
        description="Input order pelanggan via telepon/datang langsung. Boleh tanpa akun."
      />
      <OrderBaruClient produkList={produkList} />
    </div>
  );
}
