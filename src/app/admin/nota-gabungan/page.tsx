import Link from "next/link";
import { eq, desc, like, or, and, inArray } from "drizzle-orm";
import { db } from "@/db";
import { orderHeader, orderItem } from "@/db/schema/order";
import { pelanggan as pelangganTable } from "@/db/schema/pelanggan";
import { PageHeader } from "@/components/AppShell";
import { requireRole } from "@/lib/permissions";
import { PickerClient } from "./PickerClient";

export const dynamic = "force-dynamic";

export default async function NotaGabunganPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; pelangganId?: string }>;
}) {
  await requireRole(["admin", "kasir"]);
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const pelangganId = sp.pelangganId ? Number(sp.pelangganId) : null;

  // Hasil pencarian pelanggan
  let pelangganHits: { id: number; nama: string; telp: string | null }[] = [];
  if (q && !pelangganId) {
    const term = `%${q}%`;
    pelangganHits = await db
      .select({
        id: pelangganTable.id,
        nama: pelangganTable.nama,
        telp: pelangganTable.telp,
      })
      .from(pelangganTable)
      .where(or(like(pelangganTable.nama, term), like(pelangganTable.telp, term)))
      .limit(20);
  }

  // Detail pelanggan & list order
  const pel = pelangganId
    ? await db.query.pelanggan.findFirst({ where: eq(pelangganTable.id, pelangganId) })
    : null;

  let orders: {
    id: number;
    nomorOrder: string;
    createdAt: string;
    status: string;
    statusBayar: string;
    totalEstimasi: number;
    totalGalon: number;
  }[] = [];

  if (pel) {
    const rows = await db
      .select({
        id: orderHeader.id,
        nomorOrder: orderHeader.nomorOrder,
        createdAt: orderHeader.createdAt,
        status: orderHeader.status,
        statusBayar: orderHeader.statusBayar,
        totalEstimasi: orderHeader.totalEstimasi,
      })
      .from(orderHeader)
      .where(
        and(
          eq(orderHeader.pelangganId, pel.id),
          eq(orderHeader.status, "selesai"),
        ),
      )
      .orderBy(desc(orderHeader.createdAt))
      .limit(100);

    // Hitung galon per order (1 query batch)
    const ids = rows.map((r) => r.id);
    const galonMap = new Map<number, number>();
    if (ids.length) {
      const itemRows = await db
        .select({ orderId: orderItem.orderId, qty: orderItem.qty })
        .from(orderItem)
        .where(inArray(orderItem.orderId, ids));
      for (const it of itemRows) {
        galonMap.set(it.orderId, (galonMap.get(it.orderId) ?? 0) + it.qty);
      }
    }

    orders = rows.map((r) => ({
      id: r.id,
      nomorOrder: r.nomorOrder,
      createdAt: r.createdAt.toISOString(),
      status: r.status,
      statusBayar: r.statusBayar,
      totalEstimasi: r.totalEstimasi,
      totalGalon: galonMap.get(r.id) ?? 0,
    }));
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl">
      <PageHeader
        title="Nota Gabungan"
        description="Gabungkan beberapa order pelanggan jadi satu dokumen invoice. Tidak menghapus / mengubah order asli."
      />

      {/* Pencarian pelanggan */}
      {!pel && (
        <div className="bg-surface border border-line rounded-2xl p-4 mb-4">
          <form method="GET" className="flex gap-2">
            <input
              name="q"
              defaultValue={q}
              placeholder="Cari pelanggan: nama atau nomor telp..."
              className="flex-1 px-3 py-2 border border-line rounded-md text-sm"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-brand-600 text-white rounded-md text-sm font-bold"
            >
              Cari
            </button>
          </form>

          {q && (
            <div className="mt-3 space-y-1">
              {pelangganHits.length === 0 ? (
                <div className="text-sm text-[color:var(--muted)]">
                  Tidak ada pelanggan cocok dengan &ldquo;{q}&rdquo;.
                </div>
              ) : (
                pelangganHits.map((p) => (
                  <Link
                    key={p.id}
                    href={`/admin/nota-gabungan?pelangganId=${p.id}`}
                    className="block px-3 py-2 hover:bg-[color:var(--surface2)] rounded-md text-sm"
                  >
                    <span className="font-bold">{p.nama}</span>{" "}
                    <span className="text-xs text-[color:var(--muted)]">{p.telp ?? "-"}</span>
                  </Link>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Daftar order pelanggan */}
      {pel && (
        <>
          <div className="bg-surface border border-line rounded-2xl p-4 mb-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-xs text-[color:var(--muted)]">Pelanggan</div>
              <div className="font-bold">{pel.nama}</div>
              <div className="text-xs text-[color:var(--muted)]">{pel.telp ?? "-"}</div>
            </div>
            <Link
              href="/admin/nota-gabungan"
              className="text-xs text-brand font-bold"
            >
              Ganti pelanggan
            </Link>
          </div>

          <PickerClient orders={orders} />
        </>
      )}
    </div>
  );
}
