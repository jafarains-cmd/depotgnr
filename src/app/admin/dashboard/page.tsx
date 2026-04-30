import Link from "next/link";
import { AlertTriangle, TrendingUp, ShoppingBag, Droplet, Users } from "lucide-react";
import { db } from "@/db";
import { transaksi } from "@/db/schema/transaksi";
import { orderHeader } from "@/db/schema/order";
import { stokGalon } from "@/db/schema/inventory";
import { user as userTable } from "@/db/schema/auth";
import { pelanggan as pelangganTable } from "@/db/schema/pelanggan";
import { sql, gte, eq, desc, ne } from "drizzle-orm";
import { formatRupiah } from "@/lib/utils";
import { countChurnRisk } from "@/lib/analytics";

export const dynamic = "force-dynamic";

const STATUS_COLOR: Record<string, { bar: string; bg: string; fg: string; label: string }> = {
  pending: { bar: "var(--accent2)", bg: "rgba(255,122,89,0.15)", fg: "var(--accent2)", label: "BARU" },
  diproses: { bar: "var(--accent)", bg: "rgba(255,210,63,0.2)", fg: "#a86a00", label: "PROSES" },
  dijemput: { bar: "#6366f1", bg: "rgba(99,102,241,0.15)", fg: "#4f46e5", label: "JEMPUT" },
  diisi: { bar: "#06b6d4", bg: "rgba(6,182,212,0.15)", fg: "#0891b2", label: "ISI" },
  diantar: { bar: "var(--brand)", bg: "var(--brand-soft)", fg: "var(--brand)", label: "ANTAR" },
  selesai: { bar: "#22C55E", bg: "rgba(34,197,94,0.12)", fg: "#16a34a", label: "SELESAI" },
  batal: { bar: "var(--muted)", bg: "var(--surface2)", fg: "var(--muted)", label: "BATAL" },
};

export default async function DashboardPage() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const startOfYesterday = new Date(startOfDay.getTime() - 24 * 60 * 60 * 1000);

  const [omzetTodayRow] = await db
    .select({ total: sql<number>`coalesce(sum(${transaksi.total}), 0)` })
    .from(transaksi)
    .where(gte(transaksi.createdAt, startOfDay));

  const [omzetYesterdayRow] = await db
    .select({ total: sql<number>`coalesce(sum(${transaksi.total}), 0)` })
    .from(transaksi)
    .where(
      sql`${transaksi.createdAt} >= ${startOfYesterday} AND ${transaksi.createdAt} < ${startOfDay}`,
    );

  const [orderTodayCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(orderHeader)
    .where(gte(orderHeader.createdAt, startOfDay));

  const [galonTerisi] = await db
    .select({ total: sql<number>`coalesce(sum(${stokGalon.jumlah}), 0)` })
    .from(stokGalon)
    .where(eq(stokGalon.status, "terisi"));

  const [pelangganCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(pelangganTable);

  const [usersRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(userTable);

  const recentOrders = await db
    .select({
      id: orderHeader.id,
      nomorOrder: orderHeader.nomorOrder,
      status: orderHeader.status,
      totalEstimasi: orderHeader.totalEstimasi,
      catatan: orderHeader.catatan,
      createdAt: orderHeader.createdAt,
      pelangganNama: pelangganTable.nama,
    })
    .from(orderHeader)
    .leftJoin(pelangganTable, eq(orderHeader.pelangganId, pelangganTable.id))
    .where(ne(orderHeader.status, "selesai"))
    .orderBy(desc(orderHeader.createdAt))
    .limit(8);

  const churnStats = await countChurnRisk();
  const totalActionable = churnStats.due + churnStats.overdue + churnStats.churn;

  const omzet = omzetTodayRow.total;
  const omzetDelta =
    omzetYesterdayRow.total > 0
      ? Math.round(((omzet - omzetYesterdayRow.total) / omzetYesterdayRow.total) * 100)
      : null;

  return (
    <div className="p-6 max-w-6xl space-y-5">
      {/* Hero card */}
      <div
        className="relative overflow-hidden rounded-3xl p-6 text-white"
        style={{ background: "var(--brand-deep)" }}
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 90% 20%, var(--brand) 0%, transparent 50%)",
          }}
        />
        <div className="relative">
          <div className="text-[11px] opacity-85 font-semibold tracking-wide">
            DASHBOARD · {new Date().toLocaleDateString("id-ID", { dateStyle: "full" })}
          </div>
          <div className="mt-3 p-5 rounded-2xl backdrop-blur-md bg-white/15">
            <div className="text-[11px] font-bold tracking-widest opacity-85">
              OMZET HARI INI
            </div>
            <div className="text-3xl sm:text-4xl font-extrabold mt-1 tracking-tight">
              {formatRupiah(omzet)}
            </div>
            {omzetDelta !== null && (
              <div
                className={`text-xs mt-1 font-semibold ${
                  omzetDelta >= 0 ? "text-emerald-300" : "text-rose-300"
                }`}
              >
                {omzetDelta >= 0 ? "↑" : "↓"} {Math.abs(omzetDelta)}% dari kemarin
              </div>
            )}

            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
              <MiniStat label="Pesanan" value={orderTodayCount.count} icon={<ShoppingBag size={14} />} />
              <MiniStat label="Galon Stok" value={galonTerisi.total} icon={<Droplet size={14} />} />
              <MiniStat label="Pelanggan" value={pelangganCount.count} icon={<Users size={14} />} />
              <MiniStat label="Total User" value={usersRow.count} icon={<TrendingUp size={14} />} />
            </div>
          </div>
        </div>
      </div>

      {/* Churn alert */}
      {totalActionable > 0 && (
        <Link
          href="/admin/analitik/follow-up"
          className="block bg-surface border border-line rounded-2xl p-4 hover:border-[color:var(--accent2)] transition"
        >
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="font-extrabold inline-flex items-center gap-1.5">
                <AlertTriangle size={16} className="text-[color:var(--accent2)]" />
                Pelanggan Perlu Follow-up
              </div>
              <p className="text-xs text-[color:var(--muted)] mt-1">
                Berdasarkan pola order tiap pelanggan.
              </p>
            </div>
            <div className="flex gap-3 text-sm">
              {churnStats.churn > 0 && (
                <div className="text-rose-600 text-center">
                  <div className="text-[10px] font-semibold uppercase">Churn</div>
                  <div className="font-extrabold text-2xl leading-none">
                    {churnStats.churn}
                  </div>
                </div>
              )}
              {churnStats.overdue > 0 && (
                <div className="text-amber-600 text-center">
                  <div className="text-[10px] font-semibold uppercase">Overdue</div>
                  <div className="font-extrabold text-2xl leading-none">
                    {churnStats.overdue}
                  </div>
                </div>
              )}
              {churnStats.due > 0 && (
                <div className="text-brand text-center">
                  <div className="text-[10px] font-semibold uppercase">Due</div>
                  <div className="font-extrabold text-2xl leading-none">
                    {churnStats.due}
                  </div>
                </div>
              )}
            </div>
          </div>
        </Link>
      )}

      {/* Pesanan masuk */}
      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-lg font-extrabold">Pesanan Masuk</h2>
          <Link href="/kasir/order" className="text-xs text-brand font-bold">
            Semua →
          </Link>
        </div>
        {recentOrders.length === 0 ? (
          <div className="bg-surface border border-line rounded-2xl p-8 text-center text-[color:var(--muted)] text-sm">
            Tidak ada order aktif.
          </div>
        ) : (
          <div className="space-y-2">
            {recentOrders.map((o) => {
              const sc = STATUS_COLOR[o.status] ?? STATUS_COLOR.pending;
              return (
                <Link
                  key={o.id}
                  href={`/kasir/order`}
                  className="block bg-surface border border-line rounded-2xl p-4 hover:border-brand transition"
                  style={{ borderLeftColor: sc.bar, borderLeftWidth: 4 }}
                >
                  <div className="flex justify-between items-center">
                    <div className="text-sm font-extrabold">
                      {o.nomorOrder} · {o.pelangganNama ?? "Walk-in"}
                    </div>
                    <span
                      className="text-[10px] px-2 py-0.5 rounded font-extrabold tracking-wide"
                      style={{ background: sc.bg, color: sc.fg }}
                    >
                      {sc.label}
                    </span>
                  </div>
                  <div className="text-xs text-[color:var(--muted)] mt-1">
                    {o.createdAt.toLocaleTimeString("id-ID", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    · {o.catatan ?? "Tanpa catatan"}
                  </div>
                  <div className="mt-2 text-base font-extrabold text-brand">
                    {formatRupiah(o.totalEstimasi)}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function MiniStat({
  label,
  value,
  icon,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
}) {
  return (
    <div className="px-3 py-2.5 bg-white/10 rounded-xl">
      <div className="text-[10px] opacity-85 inline-flex items-center gap-1">
        {icon} {label}
      </div>
      <div className="text-xl font-extrabold mt-1 leading-none">{value}</div>
    </div>
  );
}
