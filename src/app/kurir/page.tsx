import Link from "next/link";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { orderHeader } from "@/db/schema/order";
import { pelanggan as pelangganTable } from "@/db/schema/pelanggan";
import { requireRole } from "@/lib/permissions";
import { MapPin, Phone, Clock, ChevronRight, Truck, Check } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function KurirHomePage() {
  const session = await requireRole(["admin", "kurir"]);

  const orders = await db
    .select({
      id: orderHeader.id,
      nomorOrder: orderHeader.nomorOrder,
      status: orderHeader.status,
      alamatAntar: orderHeader.alamatAntar,
      jadwalAntar: orderHeader.jadwalAntar,
      totalEstimasi: orderHeader.totalEstimasi,
      catatan: orderHeader.catatan,
      pelangganNama: pelangganTable.nama,
      pelangganTelp: pelangganTable.telp,
      diantarAt: orderHeader.diantarAt,
    })
    .from(orderHeader)
    .leftJoin(pelangganTable, eq(orderHeader.pelangganId, pelangganTable.id))
    .where(
      and(
        eq(orderHeader.kurirUserId, session.user.id),
        inArray(orderHeader.status, ["diproses", "diantar"]),
      ),
    )
    .orderBy(orderHeader.jadwalAntar);

  const todayDone = await db
    .select({ id: orderHeader.id, nomorOrder: orderHeader.nomorOrder, total: orderHeader.totalEstimasi })
    .from(orderHeader)
    .where(
      and(
        eq(orderHeader.kurirUserId, session.user.id),
        eq(orderHeader.status, "selesai"),
      ),
    )
    .limit(50);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={<Truck size={18} />} label="Order Aktif" value={orders.length} />
        <StatCard icon={<Check size={18} />} label="Selesai" value={todayDone.length} />
      </div>

      <h2 className="text-sm font-semibold text-slate-700 mt-2">Order Aktif</h2>

      {orders.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500">
          Tidak ada order yang ditugaskan. Tunggu admin assign.
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map((o) => (
            <Link
              key={o.id}
              href={`/kurir/${o.id}`}
              className="block bg-white rounded-xl border border-slate-200 p-3 hover:border-brand-400 transition"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm">{o.nomorOrder}</span>
                    <StatusBadge status={o.status} />
                  </div>
                  <div className="text-sm font-medium">{o.pelangganNama ?? "Pelanggan"}</div>
                  {o.alamatAntar && (
                    <div className="text-xs text-slate-600 inline-flex items-start gap-1 mt-1">
                      <MapPin size={12} className="mt-0.5 flex-shrink-0" />
                      <span className="line-clamp-2">{o.alamatAntar}</span>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-slate-500">
                    {o.pelangganTelp && (
                      <span className="inline-flex items-center gap-1">
                        <Phone size={11} /> {o.pelangganTelp}
                      </span>
                    )}
                    {o.jadwalAntar && (
                      <span className="inline-flex items-center gap-1">
                        <Clock size={11} />
                        {new Date(o.jadwalAntar).toLocaleString("id-ID", {
                          weekday: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight size={18} className="text-slate-400 flex-shrink-0 mt-1" />
              </div>
              <div className="mt-2 pt-2 border-t border-slate-100 text-xs text-slate-500 flex justify-between">
                <span>Total estimasi</span>
                <span className="font-medium text-slate-900">
                  Rp {o.totalEstimasi.toLocaleString("id-ID")}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3">
      <div className="text-slate-500 text-xs inline-flex items-center gap-1.5">
        {icon} {label}
      </div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    diproses: "bg-amber-100 text-amber-800",
    diantar: "bg-blue-100 text-blue-800",
    selesai: "bg-emerald-100 text-emerald-800",
  };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded ${map[status] ?? "bg-slate-100"}`}>
      {status}
    </span>
  );
}
