import { redirect } from "next/navigation";
import { db } from "@/db";
import { eq } from "drizzle-orm";
import { produk } from "@/db/schema/produk";
import { PageHeader } from "@/components/AppShell";
import { requireRole } from "@/lib/permissions";
import { OrderBaruClient } from "./OrderBaruClient";
import { getShiftAktif, isShiftStale } from "@/lib/shift";

export const dynamic = "force-dynamic";

export default async function OrderBaruKasirPage() {
  const session = await requireRole(["admin", "kasir"]);

  // Pastikan kasir punya shift aktif sebelum bikin order (atas nama mereka)
  const shiftAktif = await getShiftAktif(session.user.id);
  if (!shiftAktif) {
    redirect(`/kasir/shift?next=${encodeURIComponent("/kasir/order/baru")}`);
  }
  if (isShiftStale(shiftAktif.openedAt)) {
    redirect(`/kasir/shift?stale=1&next=${encodeURIComponent("/kasir/order/baru")}`);
  }

  const produkList = await db.query.produk.findMany({
    where: eq(produk.aktif, true),
    orderBy: (p, { asc }) => [asc(p.id)],
  });

  return (
    <div className="p-4 md:p-6 max-w-3xl">
      <PageHeader
        title="Buat Order (Walk-in)"
        description="Input order pelanggan via telepon/datang langsung. Boleh tanpa akun."
      />
      <OrderBaruClient produkList={produkList} />
    </div>
  );
}
