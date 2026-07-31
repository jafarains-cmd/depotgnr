import { sql, gte, lte, and, eq, isNull, isNotNull, ne, desc, or } from "drizzle-orm";
import { db } from "@/db";
import { transaksi } from "@/db/schema/transaksi";
import { orderHeader } from "@/db/schema/order";
import { pengeluaran } from "@/db/schema/pengeluaran";
import { kasMasuk } from "@/db/schema/kas-masuk";
import { PageHeader } from "@/components/AppShell";
import { requireRole } from "@/lib/permissions";
import { formatRupiah } from "@/lib/utils";
import { parseRange } from "@/lib/date-range";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { LaporanNav } from "../LaporanNav";
import { PrintStyles, PrintHeader } from "../PrintStyles";

export const dynamic = "force-dynamic";

export default async function CashFlowPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  await requireRole(["admin"]);
  const sp = await searchParams;
  const range = parseRange(sp);
  const from = range.from;
  const to = range.to;

  // ====== 1. POS langsung (transaksi tanpa refOrderId) ======
  const posConds = [
    isNull(transaksi.refOrderId),
    eq(transaksi.status, "lunas"),
    isNull(transaksi.voidedAt),
  ];
  if (from) posConds.push(gte(transaksi.createdAt, from));
  if (to) posConds.push(lte(transaksi.createdAt, to));

  const [posRow] = await db
    .select({
      total: sql<number>`coalesce(sum(${transaksi.total}), 0)`,
      cash: sql<number>`coalesce(sum(case when ${transaksi.metodeBayar} = 'cash' then ${transaksi.total} else 0 end), 0)`,
      transfer: sql<number>`coalesce(sum(case when ${transaksi.metodeBayar} = 'transfer' then ${transaksi.total} else 0 end), 0)`,
      qris: sql<number>`coalesce(sum(case when ${transaksi.metodeBayar} = 'qris' then ${transaksi.total} else 0 end), 0)`,
      jumlah: sql<number>`count(*)`,
    })
    .from(transaksi)
    .where(and(...posConds));

  // ====== 2. Order lunas (pakai bayarAt sebagai anchor tanggal) ======
  const orderConds = [
    eq(orderHeader.statusBayar, "lunas"),
    isNotNull(orderHeader.bayarAt),
  ];
  if (from) orderConds.push(gte(orderHeader.bayarAt, from));
  if (to) orderConds.push(lte(orderHeader.bayarAt, to));

  // Fresh: selesai di periode ini (bayar di periode yang sama)
  // Piutang lama: selesai sebelum range.from, baru dibayar di periode ini
  const freshExpr = from
    ? sql<number>`coalesce(sum(case when ${orderHeader.selesaiAt} >= ${from} then ${orderHeader.totalEstimasi} else 0 end), 0)`
    : sql<number>`coalesce(sum(${orderHeader.totalEstimasi}), 0)`;
  const piutangLamaExpr = from
    ? sql<number>`coalesce(sum(case when ${orderHeader.selesaiAt} < ${from} then ${orderHeader.totalEstimasi} else 0 end), 0)`
    : sql<number>`0`;
  const freshCountExpr = from
    ? sql<number>`sum(case when ${orderHeader.selesaiAt} >= ${from} then 1 else 0 end)`
    : sql<number>`count(*)`;
  const piutangLamaCountExpr = from
    ? sql<number>`sum(case when ${orderHeader.selesaiAt} < ${from} then 1 else 0 end)`
    : sql<number>`0`;

  const [orderRow] = await db
    .select({
      total: sql<number>`coalesce(sum(${orderHeader.totalEstimasi}), 0)`,
      fresh: freshExpr,
      piutangLama: piutangLamaExpr,
      freshCount: freshCountExpr,
      piutangLamaCount: piutangLamaCountExpr,
      cash: sql<number>`coalesce(sum(case when ${orderHeader.metodeBayar} in ('cash','cod') then ${orderHeader.totalEstimasi} else 0 end), 0)`,
      transfer: sql<number>`coalesce(sum(case when ${orderHeader.metodeBayar} in ('transfer','dana') then ${orderHeader.totalEstimasi} else 0 end), 0)`,
      qris: sql<number>`coalesce(sum(case when ${orderHeader.metodeBayar} = 'qris' then ${orderHeader.totalEstimasi} else 0 end), 0)`,
      jumlah: sql<number>`count(*)`,
    })
    .from(orderHeader)
    .where(and(...orderConds));

  // ====== 3. Kas Masuk Lain ======
  const kmConds = [];
  if (from) kmConds.push(gte(kasMasuk.tanggal, from));
  if (to) kmConds.push(lte(kasMasuk.tanggal, to));
  const kmWhere = kmConds.length ? and(...kmConds) : undefined;

  const [kmRow] = await db
    .select({
      total: sql<number>`coalesce(sum(${kasMasuk.jumlah}), 0)`,
      jumlah: sql<number>`count(*)`,
    })
    .from(kasMasuk)
    .where(kmWhere);

  const kmBreakdown = await db
    .select({
      kategori: kasMasuk.kategori,
      total: sql<number>`coalesce(sum(${kasMasuk.jumlah}), 0)`,
      jumlah: sql<number>`count(*)`,
    })
    .from(kasMasuk)
    .where(kmWhere)
    .groupBy(kasMasuk.kategori)
    .orderBy(desc(sql`sum(${kasMasuk.jumlah})`));

  // ====== 4. Pengeluaran ======
  const pengConds = [];
  if (from) pengConds.push(gte(pengeluaran.tanggal, from));
  if (to) pengConds.push(lte(pengeluaran.tanggal, to));
  const pengWhere = pengConds.length ? and(...pengConds) : undefined;

  const [pengRow] = await db
    .select({
      total: sql<number>`coalesce(sum(${pengeluaran.jumlah}), 0)`,
      jumlah: sql<number>`count(*)`,
    })
    .from(pengeluaran)
    .where(pengWhere);

  const pengBreakdown = await db
    .select({
      kategori: pengeluaran.kategori,
      total: sql<number>`coalesce(sum(${pengeluaran.jumlah}), 0)`,
      jumlah: sql<number>`count(*)`,
    })
    .from(pengeluaran)
    .where(pengWhere)
    .groupBy(pengeluaran.kategori)
    .orderBy(desc(sql`sum(${pengeluaran.jumlah})`));

  // ====== 5. Piutang beredar saat ini (all-time snapshot) ======
  const [piutangRow] = await db
    .select({
      total: sql<number>`coalesce(sum(${orderHeader.totalEstimasi} - ${orderHeader.paidPartial}), 0)`,
      jumlah: sql<number>`count(*)`,
    })
    .from(orderHeader)
    .where(
      and(
        ne(orderHeader.statusBayar, "lunas"),
        ne(orderHeader.status, "batal"),
        eq(orderHeader.status, "selesai"),
      ),
    );

  // Piutang beredar > 30 hari (aging warning)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [piutangTuaRow] = await db
    .select({
      total: sql<number>`coalesce(sum(${orderHeader.totalEstimasi} - ${orderHeader.paidPartial}), 0)`,
      jumlah: sql<number>`count(*)`,
    })
    .from(orderHeader)
    .where(
      and(
        ne(orderHeader.statusBayar, "lunas"),
        eq(orderHeader.status, "selesai"),
        or(
          lte(orderHeader.selesaiAt, thirtyDaysAgo),
          and(isNull(orderHeader.selesaiAt), lte(orderHeader.createdAt, thirtyDaysAgo)),
        ),
      ),
    );

  // ====== Total kalkulasi ======
  const posTotal = Number(posRow?.total ?? 0);
  const orderTotal = Number(orderRow?.total ?? 0);
  const kmTotal = Number(kmRow?.total ?? 0);
  const pengTotal = Number(pengRow?.total ?? 0);

  const cashIn = posTotal + orderTotal + kmTotal;
  const cashOut = pengTotal;
  const netCashFlow = cashIn - cashOut;

  // Breakdown metode total (POS + Order)
  const cashTotal = Number(posRow?.cash ?? 0) + Number(orderRow?.cash ?? 0);
  const transferTotal = Number(posRow?.transfer ?? 0) + Number(orderRow?.transfer ?? 0);
  const qrisTotal = Number(posRow?.qris ?? 0) + Number(orderRow?.qris ?? 0);

  const fromStr = from?.toISOString().slice(0, 10) ?? "";
  const toStr = to?.toISOString().slice(0, 10) ?? "";

  const piutangLamaJml = Number(orderRow?.piutangLama ?? 0);
  const piutangLamaCount = Number(orderRow?.piutangLamaCount ?? 0);

  return (
    <div className="p-4 md:p-6 space-y-4 laporan-print">
      <PrintStyles />
      <div className="no-print">
        <PageHeader
          title="Arus Kas (Cash Flow)"
          description='"Kapan uang beneran diterima" — bukan "kapan barang keluar". Piutang lama yang baru dibayar akan muncul di sini.'
        />
      </div>
      <LaporanNav active="/admin/laporan/cash-flow" />

      <PrintHeader title="LAPORAN ARUS KAS" fromStr={fromStr} toStr={toStr} />

      <div className="no-print">
        <DateRangeFilter
          active={range.key}
          customFrom={from}
          customTo={to}
          basePath="/admin/laporan/cash-flow"
        />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
        <BigCard
          label="UANG MASUK"
          value={formatRupiah(cashIn)}
          color="emerald"
          icon="↓"
        />
        <BigCard
          label="UANG KELUAR"
          value={formatRupiah(cashOut)}
          color="rose"
          icon="↑"
        />
        <BigCard
          label="NET ARUS KAS"
          value={formatRupiah(netCashFlow)}
          color={netCashFlow >= 0 ? "blue" : "amber"}
          icon="="
          highlight
        />
        <BigCard
          label="PIUTANG BEREDAR"
          value={formatRupiah(Number(piutangRow?.total ?? 0))}
          color="amber"
          subtitle={`${Number(piutangRow?.jumlah ?? 0)} order`}
        />
      </div>

      {/* Aging warning */}
      {Number(piutangTuaRow?.total ?? 0) > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3 no-print">
          <div className="text-xs font-bold text-rose-900 inline-flex items-center gap-2">
            ⚠ PIUTANG {'>'} 30 HARI
          </div>
          <div className="text-lg font-extrabold text-rose-900 mt-1">
            {formatRupiah(Number(piutangTuaRow?.total ?? 0))}
          </div>
          <div className="text-[11px] text-rose-800 mt-0.5">
            {Number(piutangTuaRow?.jumlah ?? 0)} order sudah lewat 30 hari — pertimbangkan reminder tegas atau write-off.
          </div>
        </div>
      )}

      {/* Breakdown Cash In */}
      <section className="bg-surface border border-line rounded-2xl p-4 space-y-3">
        <div className="flex items-baseline justify-between gap-2 flex-wrap">
          <h2 className="font-extrabold text-sm inline-flex items-center gap-1.5">
            <span className="text-emerald-700">📥</span> UANG MASUK — Rincian
          </h2>
          <span className="text-sm font-extrabold text-emerald-700 tabular-nums">
            {formatRupiah(cashIn)}
          </span>
        </div>

        <div className="space-y-2">
          <BreakdownRow
            label="POS langsung (kasir depot)"
            sublabel={`${Number(posRow?.jumlah ?? 0)} transaksi`}
            amount={posTotal}
          />
          <BreakdownRow
            label="Order Antar dibayar periode ini"
            sublabel={`${Number(orderRow?.jumlah ?? 0)} order`}
            amount={orderTotal}
            children={
              orderTotal > 0 && (
                <div className="ml-4 mt-1 space-y-1 text-[11px]">
                  <div className="flex justify-between text-[color:var(--muted)]">
                    <span>
                      • Fresh (order & bayar periode sama):{" "}
                      <span className="text-[color:var(--muted)]">{Number(orderRow?.freshCount ?? 0)} order</span>
                    </span>
                    <span className="tabular-nums">{formatRupiah(Number(orderRow?.fresh ?? 0))}</span>
                  </div>
                  {piutangLamaJml > 0 && (
                    <div className="flex justify-between text-amber-800 font-semibold">
                      <span>
                        • Piutang lama masuk:{" "}
                        <span className="opacity-70">{piutangLamaCount} order</span>
                      </span>
                      <span className="tabular-nums">{formatRupiah(piutangLamaJml)}</span>
                    </div>
                  )}
                </div>
              )
            }
          />
          <BreakdownRow
            label="Kas Masuk Lain (tip, pelunasan offline, dll)"
            sublabel={`${Number(kmRow?.jumlah ?? 0)} entri`}
            amount={kmTotal}
            children={
              kmBreakdown.length > 0 && (
                <div className="ml-4 mt-1 space-y-1 text-[11px]">
                  {kmBreakdown.map((k) => (
                    <div key={k.kategori} className="flex justify-between text-[color:var(--muted)]">
                      <span className="capitalize">
                        • {k.kategori.replace(/-/g, " ")}{" "}
                        <span className="opacity-70">({Number(k.jumlah)}×)</span>
                      </span>
                      <span className="tabular-nums">{formatRupiah(Number(k.total))}</span>
                    </div>
                  ))}
                </div>
              )
            }
          />
        </div>

        {/* Total per metode bayar (info) */}
        {(cashTotal + transferTotal + qrisTotal) > 0 && (
          <div className="pt-3 border-t border-line">
            <div className="text-[10px] font-bold tracking-widest text-[color:var(--muted)] mb-1.5">
              PECAHAN METODE (POS + Order)
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <MethodPill label="Cash" value={cashTotal} color="emerald" />
              <MethodPill label="Transfer" value={transferTotal} color="blue" />
              <MethodPill label="QRIS" value={qrisTotal} color="violet" />
            </div>
          </div>
        )}
      </section>

      {/* Breakdown Cash Out */}
      <section className="bg-surface border border-line rounded-2xl p-4 space-y-3">
        <div className="flex items-baseline justify-between gap-2 flex-wrap">
          <h2 className="font-extrabold text-sm inline-flex items-center gap-1.5">
            <span className="text-rose-700">📤</span> UANG KELUAR — Rincian
          </h2>
          <span className="text-sm font-extrabold text-rose-700 tabular-nums">
            {formatRupiah(cashOut)}
          </span>
        </div>

        {pengBreakdown.length === 0 ? (
          <div className="text-xs text-[color:var(--muted)] italic">
            Belum ada pengeluaran pada periode ini.
          </div>
        ) : (
          <div className="space-y-1.5">
            {pengBreakdown.map((p) => (
              <div
                key={p.kategori}
                className="flex justify-between items-center text-sm py-1.5 border-b border-line last:border-0"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 font-bold capitalize shrink-0">
                    {p.kategori.replace(/-/g, " ")}
                  </span>
                  <span className="text-[11px] text-[color:var(--muted)]">
                    {Number(p.jumlah)} entri
                  </span>
                </div>
                <span className="font-bold text-rose-700 tabular-nums shrink-0">
                  {formatRupiah(Number(p.total))}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Net Cash Flow banner */}
      <section
        className={`rounded-2xl p-4 border ${
          netCashFlow >= 0
            ? "bg-emerald-50 border-emerald-200"
            : "bg-rose-50 border-rose-200"
        }`}
      >
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-[10px] font-bold tracking-widest text-[color:var(--muted)]">
              NET ARUS KAS PERIODE INI
            </div>
            <div
              className={`text-2xl md:text-3xl font-extrabold mt-0.5 tabular-nums ${
                netCashFlow >= 0 ? "text-emerald-700" : "text-rose-700"
              }`}
            >
              {netCashFlow >= 0 ? "+" : ""}
              {formatRupiah(netCashFlow)}
            </div>
          </div>
          <div className="text-[11px] text-[color:var(--muted)] max-w-xs text-right leading-snug">
            {netCashFlow >= 0
              ? "Uang masuk lebih besar dari yang keluar. Sisa jadi tabungan / stok."
              : "Uang keluar lebih besar dari yang masuk. Perlu evaluasi pengeluaran atau tingkatkan penagihan piutang."}
          </div>
        </div>
      </section>

      {/* Info footer */}
      <div className="bg-[color:var(--surface2)] rounded-xl p-3 text-[11px] text-[color:var(--muted)] leading-relaxed no-print">
        <b>Beda dengan Laporan Penjualan:</b> laporan ini melihat{" "}
        <b>kapan uang beneran diterima</b> (via <code>bayar_at</code>). Kalau
        piutang tanggal 20 Juli baru dibayar 1 Agustus → muncul di{" "}
        <b>Agustus</b> di sini. Sedangkan di Laporan Penjualan tetap masuk{" "}
        <b>Juli</b> (accrual, tanggal barang selesai diantar).
      </div>
    </div>
  );
}

function BigCard({
  label,
  value,
  color,
  icon,
  subtitle,
  highlight,
}: {
  label: string;
  value: string;
  color: "emerald" | "rose" | "blue" | "amber";
  icon?: string;
  subtitle?: string;
  highlight?: boolean;
}) {
  const colorMap = {
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-700",
    rose: "bg-rose-50 border-rose-200 text-rose-700",
    blue: "bg-blue-50 border-blue-200 text-blue-700",
    amber: "bg-amber-50 border-amber-200 text-amber-700",
  };
  return (
    <div
      className={`rounded-xl border px-2 md:px-3 py-2 min-w-0 ${colorMap[color]} ${highlight ? "ring-2 ring-offset-1 ring-blue-300" : ""}`}
    >
      <div className="text-[10px] tracking-widest font-bold opacity-80 truncate">
        {icon && <span className="mr-1">{icon}</span>}
        {label}
      </div>
      <div className="text-sm md:text-base font-extrabold mt-0.5 tabular-nums truncate">
        {value}
      </div>
      {subtitle && (
        <div className="text-[10px] opacity-70 mt-0.5 truncate">{subtitle}</div>
      )}
    </div>
  );
}

function BreakdownRow({
  label,
  sublabel,
  amount,
  children,
}: {
  label: string;
  sublabel?: string;
  amount: number;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex justify-between items-baseline gap-2">
        <div className="min-w-0">
          <div className="text-sm font-bold truncate">{label}</div>
          {sublabel && (
            <div className="text-[11px] text-[color:var(--muted)]">{sublabel}</div>
          )}
        </div>
        <div className="text-sm font-extrabold tabular-nums shrink-0">
          {formatRupiah(amount)}
        </div>
      </div>
      {children}
    </div>
  );
}

function MethodPill({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "emerald" | "blue" | "violet";
}) {
  const colorMap = {
    emerald: "bg-emerald-50 text-emerald-700",
    blue: "bg-blue-50 text-blue-700",
    violet: "bg-violet-50 text-violet-700",
  };
  return (
    <div className={`rounded-lg px-2 py-1.5 ${colorMap[color]} min-w-0`}>
      <div className="text-[10px] font-bold opacity-80">{label}</div>
      <div className="text-xs font-extrabold tabular-nums truncate">
        {formatRupiah(value)}
      </div>
    </div>
  );
}
