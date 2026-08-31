import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { BadgeCheck, Phone, MapPin, Package } from "lucide-react";
import { db } from "@/db";
import { pelanggan, galonDipinjam } from "@/db/schema/pelanggan";
import { orderHeader } from "@/db/schema/order";
import { requireRole } from "@/lib/permissions";
import { PageHeader } from "@/components/AppShell";
import { getDefaultLimitGalon } from "@/lib/langganan";

export const dynamic = "force-dynamic";

export default async function LanggananListPage() {
  await requireRole(["admin", "kasir"]);

  const defaultLimit = await getDefaultLimitGalon();

  // Semua pelanggan tipe=langganan (verified)
  const rows = await db
    .select({
      id: pelanggan.id,
      nama: pelanggan.nama,
      telp: pelanggan.telp,
      alamat: pelanggan.alamat,
      limitGalon: pelanggan.limitGalon,
      ktpVerifiedAt: pelanggan.ktpVerifiedAt,
    })
    .from(pelanggan)
    .where(eq(pelanggan.tipe, "langganan"))
    .orderBy(desc(pelanggan.ktpVerifiedAt));

  const ids = rows.map((r) => r.id);
  const galonRows = ids.length
    ? await db
        .select({
          pelangganId: galonDipinjam.pelangganId,
          total: sql<number>`sum(${galonDipinjam.jumlah})`,
        })
        .from(galonDipinjam)
        .where(sql`${galonDipinjam.pelangganId} IN ${ids}`)
        .groupBy(galonDipinjam.pelangganId)
    : [];
  const galonMap = new Map(galonRows.map((r) => [r.pelangganId, Number(r.total ?? 0)]));

  const orderRows = ids.length
    ? await db
        .select({
          pelangganId: orderHeader.pelangganId,
          jumlah: sql<number>`count(*)`,
          lastOrderAt: sql<Date>`max(${orderHeader.createdAt})`,
        })
        .from(orderHeader)
        .where(sql`${orderHeader.pelangganId} IN ${ids}`)
        .groupBy(orderHeader.pelangganId)
    : [];
  const orderMap = new Map(
    orderRows.map((r) => [
      r.pelangganId,
      {
        jumlah: Number(r.jumlah ?? 0),
        lastOrderAt: r.lastOrderAt instanceof Date ? r.lastOrderAt : new Date(r.lastOrderAt),
      },
    ]),
  );

  const enriched = rows.map((r) => ({
    ...r,
    galonDipegang: galonMap.get(r.id) ?? 0,
    effectiveLimit: r.limitGalon ?? defaultLimit,
    order: orderMap.get(r.id) ?? null,
  }));

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title="Pelanggan Langganan"
        description={`${rows.length} pelanggan terverifikasi. Default limit galon: ${defaultLimit}. Klik nama untuk detail.`}
      />

      {rows.length === 0 ? (
        <div className="bg-surface border border-line rounded-2xl p-8 text-center">
          <BadgeCheck size={40} className="mx-auto text-[color:var(--muted)] mb-3" />
          <div className="font-bold">Belum ada pelanggan langganan</div>
          <p className="text-sm text-[color:var(--muted)] mt-1">
            Ajukan langganan bisa dilakukan pelanggan dari halaman Profil di app mereka.
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {enriched.map((r) => {
            const overLimit = r.galonDipegang > r.effectiveLimit;
            return (
              <Link
                key={r.id}
                href={`/data-pelanggan/${r.id}`}
                className="bg-surface border border-line rounded-2xl p-3 hover:border-brand transition"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-sm truncate">{r.nama}</div>
                    {r.telp && (
                      <div className="text-[11px] text-[color:var(--muted)] inline-flex items-center gap-1">
                        <Phone size={10} /> {r.telp}
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 inline-flex items-center gap-0.5">
                    <BadgeCheck size={10} /> LANGGANAN
                  </span>
                </div>

                {r.alamat && (
                  <div className="text-[11px] text-[color:var(--muted)] mt-1 inline-flex items-start gap-1">
                    <MapPin size={10} className="mt-0.5 flex-shrink-0" />
                    <span className="line-clamp-2">{r.alamat}</span>
                  </div>
                )}

                <div className="mt-2 flex items-center justify-between text-xs">
                  <div className="inline-flex items-center gap-1">
                    <Package
                      size={12}
                      className={overLimit ? "text-rose-600" : "text-blue-600"}
                    />
                    <span
                      className={`font-bold ${overLimit ? "text-rose-600" : "text-blue-700"}`}
                    >
                      {r.galonDipegang}/{r.effectiveLimit}
                    </span>
                    <span className="text-[color:var(--muted)]">galon</span>
                  </div>
                  <div className="text-[11px] text-[color:var(--muted)]">
                    {r.order?.jumlah ?? 0} order
                  </div>
                </div>

                <div className="mt-1 text-[10px] text-[color:var(--muted)]">
                  Verified:{" "}
                  {r.ktpVerifiedAt
                    ? r.ktpVerifiedAt.toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })
                    : "—"}
                  {r.order?.lastOrderAt && (
                    <>
                      {" · Last order: "}
                      {r.order.lastOrderAt.toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                      })}
                    </>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
