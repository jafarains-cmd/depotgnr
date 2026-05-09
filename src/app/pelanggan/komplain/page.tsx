import Link from "next/link";
import { eq, desc } from "drizzle-orm";
import { Plus, MessageSquareWarning } from "lucide-react";
import { db } from "@/db";
import { komplain } from "@/db/schema/komplain";
import { requireSession } from "@/lib/permissions";
import { getOrCreatePelanggan } from "@/lib/pelanggan";
import { KomplainList } from "./KomplainList";

export const dynamic = "force-dynamic";

export default async function KomplainPelangganPage() {
  const session = await requireSession();
  const me = await getOrCreatePelanggan(session.user.id, session.user.name);

  const list = await db
    .select()
    .from(komplain)
    .where(eq(komplain.pelangganId, me.id))
    .orderBy(desc(komplain.createdAt))
    .limit(50);

  return (
    <div>
      <div className="bg-surface border-b border-line -mx-4 sm:mx-0 sm:rounded-t-2xl px-4 sm:px-5 pt-3 pb-3 mb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight inline-flex items-center gap-2">
              <MessageSquareWarning size={22} /> Komplain
            </h1>
            <p className="text-sm text-[color:var(--muted)] mt-0.5">
              Laporkan masalah produk/order. Admin akan tindak lanjut.
            </p>
          </div>
          <Link
            href="/pelanggan/komplain/baru"
            className="px-4 py-2 bg-brand-600 text-white rounded-md text-sm font-bold inline-flex items-center gap-1.5"
          >
            <Plus size={14} /> Komplain Baru
          </Link>
        </div>
      </div>

      <KomplainList
        rows={list.map((k) => ({
          id: k.id,
          jenis: k.jenis,
          deskripsi: k.deskripsi,
          fotoUrl: k.fotoUrl,
          status: k.status,
          resolusi: k.resolusi,
          kompensasiLoyalti: k.kompensasiLoyalti,
          refOrderId: k.refOrderId,
          createdAt: k.createdAt.toISOString(),
          resolvedAt: k.resolvedAt?.toISOString() ?? null,
        }))}
      />
    </div>
  );
}
