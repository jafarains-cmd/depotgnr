import Link from "next/link";
import { AlertTriangle, TrendingUp, ShoppingBag, Droplet, Users } from "lucide-react";
import { db } from "@/db";
import { transaksi } from "@/db/schema/transaksi";
import { orderHeader } from "@/db/schema/order";
import { stokGalon } from "@/db/schema/inventory";
import { user as userTable } from "@/db/schema/auth";
import { pelanggan as pelangganTable } from "@/db/schema/pelanggan";
import { pengeluaran } from "@/db/schema/pengeluaran";
import { filter } from "@/db/schema/filter";
import { computeFilterStatus } from "@/lib/filter-status";
import { bahanBaku } from "@/db/schema/bahan-baku";
import { sql, gte, eq, desc, ne, lt, and, isNull } from "drizzle-orm";
import { formatRupiah } from "@/lib/utils";
import { countChurnRisk } from "@/lib/analytics";
import {
  getSemuaShiftAktif,
  isShiftStale,
  ringkasanShift,
  getShiftStaleThresholdJam,
} from "@/lib/shift";
import { Clock, Lock } from "lucide-react";

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
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const startOfYesterday = new Date(startOfDay.getTime() - 24 * 60 * 60 * 1000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = startOfMonth;

  const [omzetTodayRow] = await db
    .select({ total: sql<number>`coalesce(sum(${transaksi.total}), 0)` })
    .from(transaksi)
    .where(and(gte(transaksi.createdAt, startOfDay), isNull(transaksi.voidedAt)));

  const [omzetYesterdayRow] = await db
    .select({ total: sql<number>`coalesce(sum(${transaksi.total}), 0)` })
    .from(transaksi)
    .where(
      and(
        gte(transaksi.createdAt, startOfYesterday),
        lt(transaksi.createdAt, startOfDay),
        isNull(transaksi.voidedAt),
      ),
    );

  const [pengeluaranTodayRow] = await db
    .select({ total: sql<number>`coalesce(sum(${pengeluaran.jumlah}), 0)` })
    .from(pengeluaran)
    .where(gte(pengeluaran.tanggal, startOfDay));

  const [omzetThisMonthRow] = await db
    .select({ total: sql<number>`coalesce(sum(${transaksi.total}), 0)` })
    .from(transaksi)
    .where(and(gte(transaksi.createdAt, startOfMonth), isNull(transaksi.voidedAt)));

  const [omzetLastMonthRow] = await db
    .select({ total: sql<number>`coalesce(sum(${transaksi.total}), 0)` })
    .from(transaksi)
    .where(
      and(
        gte(transaksi.createdAt, startOfLastMonth),
        lt(transaksi.createdAt, endOfLastMonth),
        isNull(transaksi.voidedAt),
      ),
    );

  const [pengeluaranThisMonthRow] = await db
    .select({ total: sql<number>`coalesce(sum(${pengeluaran.jumlah}), 0)` })
    .from(pengeluaran)
    .where(gte(pengeluaran.tanggal, startOfMonth));

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

  const churnStats = await countChurnRisk().catch(() => ({ due: 0, overdue: 0, churn: 0 }));
  const totalActionable = churnStats.due + churnStats.overdue + churnStats.churn;

  // Bahan baku stok menipis (aktif + threshold > 0 + stok <= threshold)
  const bahanBakuRows = await db.query.bahanBaku.findMany({
    where: eq(bahanBaku.aktif, true),
  });
  const bahanLow = bahanBakuRows.filter(
    (b) => b.threshold > 0 && b.stok <= b.threshold,
  );

  // Filter pemeliharaan — count overdue & due_soon (cuma yang aktif)
  const filterRows = await db.query.filter.findMany({ where: eq(filter.aktif, true) });
  const filterAlerts = filterRows.reduce(
    (acc, f) => {
      const s = computeFilterStatus({
        gantiTerakhir: f.gantiTerakhir,
        intervalHari: f.intervalHari,
      });
      if (s.status === "overdue") acc.overdue.push({ nama: f.nama, daysLeft: s.daysLeft });
      else if (s.status === "due_soon")
        acc.dueSoon.push({ nama: f.nama, daysLeft: s.daysLeft });
      return acc;
    },
    {
      overdue: [] as { nama: string; daysLeft: number | null }[],
      dueSoon: [] as { nama: string; daysLeft: number | null }[],
    },
  );

  const omzet = omzetTodayRow.total;
  const pengeluaranToday = pengeluaranTodayRow.total;
  const profitBersih = omzet - pengeluaranToday;
  const omzetDelta =
    omzetYesterdayRow.total > 0
      ? Math.round(((omzet - omzetYesterdayRow.total) / omzetYesterdayRow.total) * 100)
      : null;

  const omzetThisMonth = omzetThisMonthRow.total;
  const omzetLastMonth = omzetLastMonthRow.total;
  const pengeluaranThisMonth = pengeluaranThisMonthRow.total;
  const profitThisMonth = omzetThisMonth - pengeluaranThisMonth;
  const omzetMonthDelta =
    omzetLastMonth > 0
      ? Math.round(((omzetThisMonth - omzetLastMonth) / omzetLastMonth) * 100)
      : null;

  // Shift kasir aktif saat ini (untuk widget dashboard)
  const shiftAktifList = await getSemuaShiftAktif();
  const shiftStaleThreshold = await getShiftStaleThresholdJam();
  const shiftAktifDetail = await Promise.all(
    shiftAktifList.map(async (s) => {
      const ring = await ringkasanShift(s.id);
      return {
        id: s.id,
        kasirNama: s.kasirNama,
        openedAt: s.openedAt,
        stale: isShiftStale(s.openedAt, shiftStaleThreshold),
        omzetCash: ring.omzetCash,
        jumlahTransaksi: ring.jumlahTransaksi,
      };
    }),
  );

  // Cek anomali stok rendah + pinjam macet (best-effort, tidak block render)
  const stokAlertModule = await import("@/lib/stok-alert");
  const [stokRendah, pinjamMacet] = await Promise.all([
    stokAlertModule.getStokRendah().catch(() => []),
    stokAlertModule.getPelangganPinjamMacet().catch(() => []),
  ]);
  const totalGalonMacet = pinjamMacet.reduce((s, p) => s + p.totalGalon, 0);

  return (
    <div className="p-4 md:p-6 max-w-6xl space-y-5">
      {/* Alert banner kalau ada stok rendah atau pinjam macet */}
      {(stokRendah.length > 0 || pinjamMacet.length > 0) && (
        <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-3 space-y-2">
          <div className="text-sm font-bold text-amber-900 inline-flex items-center gap-1.5">
            <AlertTriangle size={16} /> Perlu Perhatian
          </div>
          <div className="grid sm:grid-cols-2 gap-2 text-xs">
            {stokRendah.length > 0 && (
              <Link
                href="/admin/inventory"
                className="bg-surface border border-amber-200 rounded-lg p-2.5 hover:border-amber-400 transition"
              >
                <div className="font-bold text-amber-800 mb-0.5">
                  🚨 Stok Terisi Rendah ({stokRendah.length} produk)
                </div>
                <div className="text-[color:var(--muted)]">
                  {stokRendah
                    .slice(0, 3)
                    .map((s) => `${s.nama}: ${s.stokTerisi}/${s.stokMinimal}`)
                    .join(" · ")}
                  {stokRendah.length > 3 && "..."}
                </div>
                <div className="text-[10px] text-amber-700 mt-1 font-semibold">
                  Waktu produksi/isi ulang →
                </div>
              </Link>
            )}
            {pinjamMacet.length > 0 && (
              <Link
                href="/admin/galon-dipinjam"
                className="bg-surface border border-amber-200 rounded-lg p-2.5 hover:border-amber-400 transition"
              >
                <div className="font-bold text-amber-800 mb-0.5">
                  📋 Pelanggan Pinjam Macet ({pinjamMacet.length})
                </div>
                <div className="text-[color:var(--muted)]">
                  {totalGalonMacet} galon di pelanggan yang tidak order &gt; 30 hari
                </div>
                <div className="text-[10px] text-amber-700 mt-1 font-semibold">
                  Follow-up sekarang →
                </div>
              </Link>
            )}
          </div>
        </div>
      )}

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

      {/* Shift Kasir Aktif */}
      {shiftAktifDetail.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-[11px] font-bold tracking-widest text-[color:var(--muted)] inline-flex items-center gap-1.5">
              <Clock size={12} /> SHIFT KASIR AKTIF ({shiftAktifDetail.length})
            </div>
            <Link
              href="/admin/shift"
              className="text-[11px] text-brand font-bold inline-flex items-center gap-0.5"
            >
              Kelola semua →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {shiftAktifDetail.map((s) => (
              <div
                key={s.id}
                className={`rounded-2xl p-3 border ${
                  s.stale
                    ? "bg-red-50 border-red-300"
                    : "bg-emerald-50 border-emerald-200"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold text-sm inline-flex items-center gap-1.5">
                      {s.kasirNama ?? "—"}
                      {s.stale && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-600 text-white font-bold animate-pulse">
                          STALE
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-[color:var(--muted)] mt-0.5">
                      Sejak{" "}
                      {s.openedAt.toLocaleString("id-ID", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                  {s.stale && (
                    <Link
                      href="/admin/shift"
                      title="Force-close shift kemarin"
                      className="text-[10px] px-2 py-1 bg-red-600 text-white rounded font-bold inline-flex items-center gap-1"
                    >
                      <Lock size={10} /> Aksi
                    </Link>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-line/50 text-xs">
                  <div>
                    <div className="text-[9px] text-[color:var(--muted)] uppercase">Transaksi</div>
                    <div className="font-bold">{s.jumlahTransaksi}</div>
                  </div>
                  <div>
                    <div className="text-[9px] text-[color:var(--muted)] uppercase">Omzet cash</div>
                    <div className="font-bold text-emerald-700">{formatRupiah(s.omzetCash)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hari ini */}
      <div>
        <div className="text-[11px] font-bold tracking-widest text-[color:var(--muted)] mb-2">
          HARI INI · {now.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" })}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
            <div className="text-[10px] font-bold tracking-widest text-emerald-700">
              OMZET
            </div>
            <div className="text-2xl font-extrabold text-emerald-900 mt-1">
              {formatRupiah(omzet)}
            </div>
          </div>
          <Link
            href="/admin/pengeluaran"
            className="bg-rose-50 border border-rose-200 rounded-2xl p-4 hover:border-rose-300 transition"
          >
            <div className="text-[10px] font-bold tracking-widest text-rose-700">
              PENGELUARAN
            </div>
            <div className="text-2xl font-extrabold text-rose-900 mt-1">
              {formatRupiah(pengeluaranToday)}
            </div>
            <div className="text-[11px] text-rose-700 mt-1">Klik untuk kelola →</div>
          </Link>
          <div
            className={`border rounded-2xl p-4 ${
              profitBersih >= 0
                ? "bg-brand-soft border-brand"
                : "bg-amber-50 border-amber-300"
            }`}
          >
            <div
              className={`text-[10px] font-bold tracking-widest ${
                profitBersih >= 0 ? "text-brand" : "text-amber-700"
              }`}
            >
              PROFIT BERSIH
            </div>
            <div
              className={`text-2xl font-extrabold mt-1 ${
                profitBersih >= 0 ? "text-brand" : "text-amber-900"
              }`}
            >
              {formatRupiah(profitBersih)}
            </div>
            <div
              className={`text-[11px] mt-1 ${
                profitBersih >= 0 ? "text-brand" : "text-amber-700"
              }`}
            >
              Omzet − Pengeluaran
            </div>
          </div>
        </div>
      </div>

      {/* Bulan ini */}
      <div>
        <div className="text-[11px] font-bold tracking-widest text-[color:var(--muted)] mb-2">
          BULAN INI ·{" "}
          {now.toLocaleDateString("id-ID", { month: "long", year: "numeric" })}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
            <div className="text-[10px] font-bold tracking-widest text-emerald-700">
              OMZET
            </div>
            <div className="text-2xl font-extrabold text-emerald-900 mt-1">
              {formatRupiah(omzetThisMonth)}
            </div>
            {omzetMonthDelta !== null && (
              <div
                className={`text-[11px] mt-1 ${
                  omzetMonthDelta >= 0 ? "text-emerald-700" : "text-rose-600"
                }`}
              >
                {omzetMonthDelta >= 0 ? "↑" : "↓"} {Math.abs(omzetMonthDelta)}% vs bulan lalu
              </div>
            )}
            {omzetMonthDelta === null && omzetLastMonth === 0 && (
              <div className="text-[11px] text-emerald-700 mt-1">Bulan lalu: Rp 0</div>
            )}
          </div>
          <Link
            href="/admin/pengeluaran"
            className="bg-rose-50 border border-rose-200 rounded-2xl p-4 hover:border-rose-300 transition"
          >
            <div className="text-[10px] font-bold tracking-widest text-rose-700">
              PENGELUARAN
            </div>
            <div className="text-2xl font-extrabold text-rose-900 mt-1">
              {formatRupiah(pengeluaranThisMonth)}
            </div>
            <div className="text-[11px] text-rose-700 mt-1">
              Listrik, gaji, sparepart, dll
            </div>
          </Link>
          <div
            className={`border rounded-2xl p-4 ${
              profitThisMonth >= 0
                ? "bg-brand-soft border-brand"
                : "bg-amber-50 border-amber-300"
            }`}
          >
            <div
              className={`text-[10px] font-bold tracking-widest ${
                profitThisMonth >= 0 ? "text-brand" : "text-amber-700"
              }`}
            >
              PROFIT BERSIH
            </div>
            <div
              className={`text-2xl font-extrabold mt-1 ${
                profitThisMonth >= 0 ? "text-brand" : "text-amber-900"
              }`}
            >
              {formatRupiah(profitThisMonth)}
            </div>
            <div
              className={`text-[11px] mt-1 ${
                profitThisMonth >= 0 ? "text-brand" : "text-amber-700"
              }`}
            >
              {profitThisMonth >= 0 ? "Untung 🎉" : "Rugi — review pengeluaran"}
            </div>
          </div>
        </div>
      </div>

      {/* Bahan baku stok menipis */}
      {bahanLow.length > 0 && (
        <Link
          href="/admin/bahan-baku"
          className="block bg-rose-50 border border-rose-200 rounded-2xl p-4 hover:border-rose-400 transition"
        >
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="font-bold text-rose-900 inline-flex items-center gap-1.5">
                <AlertTriangle size={16} />
                Stok Bahan Baku Menipis
              </div>
              <div className="text-xs mt-1 space-y-0.5">
                {bahanLow.map((b) => (
                  <div key={b.id} className="text-rose-800">
                    🔴 <strong>{b.nama}</strong> — sisa {b.stok} {b.satuan} (threshold{" "}
                    {b.threshold})
                  </div>
                ))}
              </div>
            </div>
            <span className="text-xs text-rose-900 font-bold whitespace-nowrap">
              Buka →
            </span>
          </div>
        </Link>
      )}

      {/* Filter pemeliharaan alert */}
      {(filterAlerts.overdue.length > 0 || filterAlerts.dueSoon.length > 0) && (
        <Link
          href="/admin/pemeliharaan"
          className={`block rounded-2xl p-4 border transition ${
            filterAlerts.overdue.length > 0
              ? "bg-rose-50 border-rose-200 hover:border-rose-400"
              : "bg-amber-50 border-amber-200 hover:border-amber-400"
          }`}
        >
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div
                className={`font-bold inline-flex items-center gap-1.5 ${
                  filterAlerts.overdue.length > 0 ? "text-rose-900" : "text-amber-900"
                }`}
              >
                <AlertTriangle size={16} />
                Pemeliharaan Filter
              </div>
              <div className="text-xs mt-1 space-y-0.5">
                {filterAlerts.overdue.map((f) => (
                  <div key={`o-${f.nama}`} className="text-rose-800">
                    🔴 <strong>{f.nama}</strong> — lewat{" "}
                    {Math.abs(f.daysLeft ?? 0)} hari
                  </div>
                ))}
                {filterAlerts.dueSoon.map((f) => (
                  <div key={`d-${f.nama}`} className="text-amber-800">
                    🟡 <strong>{f.nama}</strong> — {f.daysLeft} hari lagi
                  </div>
                ))}
              </div>
            </div>
            <span
              className={`text-xs font-bold inline-flex items-center gap-1 whitespace-nowrap ${
                filterAlerts.overdue.length > 0 ? "text-rose-900" : "text-amber-900"
              }`}
            >
              Buka →
            </span>
          </div>
        </Link>
      )}

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
