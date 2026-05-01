import Link from "next/link";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { orderHeader } from "@/db/schema/order";
import { pelanggan as pelangganTable } from "@/db/schema/pelanggan";
import { requireRole } from "@/lib/permissions";
import { MapPin, Phone, Clock, ChevronRight, Truck, Check, Coins } from "lucide-react";
import { formatRupiah } from "@/lib/utils";
import { getBonusConfig, summaryBonusKurir } from "@/lib/bonus";

export const dynamic = "force-dynamic";

export default async function KurirHomePage() {
  const session = await requireRole(["admin", "kasir", "kurir"]);

  const orders = await db
    .select({
      id: orderHeader.id,
      nomorOrder: orderHeader.nomorOrder,
      status: orderHeader.status,
      tipePengantaran: orderHeader.tipePengantaran,
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
        inArray(orderHeader.status, ["diproses", "dijemput", "diisi", "diantar"]),
      ),
    )
    .orderBy(orderHeader.jadwalAntar);

  const todayDone = await db
    .select({
      id: orderHeader.id,
      nomorOrder: orderHeader.nomorOrder,
      total: orderHeader.totalEstimasi,
    })
    .from(orderHeader)
    .where(
      and(
        eq(orderHeader.kurirUserId, session.user.id),
        eq(orderHeader.status, "selesai"),
      ),
    )
    .limit(50);

  const totalSelesaiHariIni = todayDone.reduce((s, t) => s + (t.total ?? 0), 0);

  // Bonus kurir summary (hanya tampil kalau pengaturan tampilkanBonusKeKurir aktif)
  const bonusCfg = await getBonusConfig();
  const bonus = bonusCfg.tampilkanKeKurir
    ? await summaryBonusKurir(session.user.id)
    : null;

  // Active task = order yang lagi diantar atau dijemput
  const activeTask = orders.find((o) =>
    ["dijemput", "diisi", "diantar"].includes(o.status),
  );
  const queue = orders.filter((o) => o.id !== activeTask?.id);

  return (
    <div className="space-y-4">
      {/* Stat header */}
      <div className="bg-brand-soft rounded-2xl p-4 flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-bold tracking-widest text-[color:var(--brand-deep)]">
            HARI INI
          </div>
          <div className="text-2xl font-extrabold text-brand mt-1">
            {formatRupiah(totalSelesaiHariIni)}
          </div>
          <div className="text-xs text-[color:var(--muted)]">
            {todayDone.length} pengantaran selesai
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex gap-2">
            <StatChip label="Aktif" value={orders.length} icon={<Truck size={14} />} />
            <StatChip label="Selesai" value={todayDone.length} icon={<Check size={14} />} />
          </div>
        </div>
      </div>

      {/* Bonus card (kalau visibility on) */}
      {bonus && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Coins size={16} className="text-amber-700" />
            <div className="text-sm font-extrabold text-amber-900">Bonus Saya</div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <div className="text-[10px] text-amber-800 font-semibold uppercase tracking-wide">
                Hari Ini
              </div>
              <div className="text-base font-extrabold text-amber-900">
                {formatRupiah(bonus.hariIni)}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-amber-800 font-semibold uppercase tracking-wide">
                Belum Dibayar
              </div>
              <div className="text-base font-extrabold text-amber-900">
                {formatRupiah(bonus.pending)}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-amber-800 font-semibold uppercase tracking-wide">
                Sudah Dibayar
              </div>
              <div className="text-base font-extrabold text-amber-900">
                {formatRupiah(bonus.totalDibayar)}
              </div>
            </div>
          </div>
          <div className="text-[10px] text-amber-800 mt-2">
            Bonus dibayar bulanan oleh owner depot.
          </div>
        </div>
      )}

      {/* Active task */}
      {activeTask && (
        <Link
          href={`/kurir/${activeTask.id}`}
          className="block relative overflow-hidden rounded-2xl p-5 text-white"
          style={{ background: "var(--brand)" }}
        >
          <div className="flex items-center justify-between gap-2">
            <span
              className="text-[10px] px-2 py-0.5 rounded font-extrabold tracking-widest bg-white/20 backdrop-blur"
            >
              TUGAS AKTIF · {activeTask.nomorOrder}
            </span>
            <span className="text-[11px] font-bold">{activeTask.status.toUpperCase()}</span>
          </div>
          <div className="mt-3">
            <div className="text-[11px] opacity-85">Antar ke</div>
            <div className="text-lg font-extrabold mt-1">
              {activeTask.pelangganNama ?? "Pelanggan"}
            </div>
            {activeTask.alamatAntar && (
              <div className="text-xs opacity-90 mt-1 inline-flex items-start gap-1">
                <MapPin size={12} className="mt-0.5 flex-shrink-0" />
                <span className="line-clamp-2">{activeTask.alamatAntar}</span>
              </div>
            )}
          </div>
          <div className="mt-3 flex items-center gap-3 text-xs">
            <div>
              <span className="opacity-75">Total: </span>
              <span className="font-extrabold">{formatRupiah(activeTask.totalEstimasi)}</span>
            </div>
            {activeTask.tipePengantaran === "jemput-antar" && (
              <span className="px-2 py-0.5 bg-white/20 rounded text-[10px] font-bold">
                🔄 jemput-isi-antar
              </span>
            )}
          </div>
          <div className="mt-4 inline-flex items-center gap-2 h-10 px-4 bg-white text-[color:var(--brand-deep)] rounded-full font-extrabold text-xs">
            Buka detail <ChevronRight size={14} />
          </div>
        </Link>
      )}

      {/* Queue list */}
      {queue.length > 0 && (
        <section>
          <div className="flex items-baseline justify-between mb-2 px-1">
            <h2 className="text-[11px] font-bold tracking-widest text-[color:var(--muted)]">
              ANTRIAN ({queue.length})
            </h2>
          </div>
          <div className="space-y-2">
            {queue.map((o) => (
              <Link
                key={o.id}
                href={`/kurir/${o.id}`}
                className="block bg-surface rounded-2xl border border-line p-3 hover:border-brand transition"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[color:var(--surface2)] text-brand grid place-items-center flex-shrink-0">
                    <MapPin size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold">{o.pelangganNama ?? "Pelanggan"}</span>
                      <StatusBadge status={o.status} />
                      {o.tipePengantaran === "jemput-antar" && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 font-bold">
                          🔄
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-[color:var(--muted)] flex flex-wrap gap-2 mt-0.5">
                      <span>{o.nomorOrder}</span>
                      {o.pelangganTelp && (
                        <span className="inline-flex items-center gap-0.5">
                          <Phone size={10} /> {o.pelangganTelp}
                        </span>
                      )}
                      {o.jadwalAntar && (
                        <span className="inline-flex items-center gap-0.5">
                          <Clock size={10} />
                          {new Date(o.jadwalAntar).toLocaleTimeString("id-ID", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      )}
                    </div>
                    {o.alamatAntar && (
                      <div className="text-[11px] text-[color:var(--muted)] mt-1 line-clamp-1">
                        📍 {o.alamatAntar}
                      </div>
                    )}
                    <div className="text-sm font-extrabold text-brand mt-1">
                      {formatRupiah(o.totalEstimasi)}
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-[color:var(--muted)] flex-shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {orders.length === 0 && (
        <div className="bg-surface rounded-2xl border border-line p-10 text-center">
          <Truck size={36} className="mx-auto text-[color:var(--muted)] mb-3" />
          <div className="text-sm font-bold">Belum ada order</div>
          <div className="text-xs text-[color:var(--muted)] mt-1">
            Tunggu admin assign order ke Anda.
          </div>
        </div>
      )}
    </div>
  );
}

function StatChip({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-white/70 backdrop-blur rounded-xl px-3 py-2 text-center">
      <div className="text-[10px] text-[color:var(--muted)] inline-flex items-center gap-1 font-semibold">
        {icon} {label}
      </div>
      <div className="text-lg font-extrabold leading-none mt-0.5">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    diproses: "bg-amber-100 text-amber-800",
    dijemput: "bg-indigo-100 text-indigo-800",
    diisi: "bg-cyan-100 text-cyan-800",
    diantar: "bg-violet-100 text-violet-800",
    selesai: "bg-emerald-100 text-emerald-800",
  };
  return (
    <span
      className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
        map[status] ?? "bg-[color:var(--surface2)] text-ink"
      }`}
    >
      {status}
    </span>
  );
}
