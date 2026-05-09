import { eq, desc } from "drizzle-orm";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { db } from "@/db";
import { orderHeader } from "@/db/schema/order";
import { requireSession } from "@/lib/permissions";
import { getOrCreatePelanggan } from "@/lib/pelanggan";
import { KomplainForm } from "./KomplainForm";

export const dynamic = "force-dynamic";

export default async function KomplainBaruPage() {
  const session = await requireSession();
  const me = await getOrCreatePelanggan(session.user.id, session.user.name);

  // Order pelanggan untuk pilih (limit 20 terbaru)
  const orders = await db
    .select({
      id: orderHeader.id,
      nomorOrder: orderHeader.nomorOrder,
      createdAt: orderHeader.createdAt,
    })
    .from(orderHeader)
    .where(eq(orderHeader.pelangganId, me.id))
    .orderBy(desc(orderHeader.createdAt))
    .limit(20);

  return (
    <div>
      <Link
        href="/pelanggan/komplain"
        className="text-sm text-[color:var(--muted)] hover:text-brand inline-flex items-center gap-1 mb-3"
      >
        <ArrowLeft size={14} /> Kembali
      </Link>

      <div className="bg-surface border border-line rounded-2xl p-4 space-y-4">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">Komplain Baru</h1>
          <p className="text-sm text-[color:var(--muted)] mt-0.5">
            Ceritakan masalah Anda. Admin akan tindak lanjut secepatnya.
          </p>
        </div>
        <KomplainForm
          orders={orders.map((o) => ({
            id: o.id,
            nomorOrder: o.nomorOrder,
            createdAt: o.createdAt.toISOString(),
          }))}
        />
      </div>
    </div>
  );
}
