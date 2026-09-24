"use client";

import { useState } from "react";
import { Coins, Star, TrendingUp, TrendingDown, X, Gift } from "lucide-react";
import { formatRupiah } from "@/lib/utils";
import { DetailModal } from "@/components/DetailModal";

type StatKind = "saldo" | "stamp" | "earn" | "redeem";

type MutasiRow = {
  id: number;
  tipe: string;
  jumlah: number;
  deskripsi: string | null;
  refOrderId: number | null;
  refTransaksiId: number | null;
  createdAt: string;
};

type Props = {
  saldoLoyalti: number;
  stampGalon: number;
  stampClaimedCount: number;
  stampThreshold: number;
  nilaiGalonGratis: number;
  totalEarn: number;
  totalRedeem: number;
  earnList: MutasiRow[];
  redeemList: MutasiRow[];
  stampList: MutasiRow[];
  recentList: MutasiRow[];
};

const TIPE_LABEL: Record<string, string> = {
  earn: "Earn galon",
  redeem: "Pakai saldo",
  referral_in: "Bonus referral",
  referral_bonus: "Bonus mengajak",
  stamp_reward: "Galon gratis",
  adjust: "Penyesuaian admin",
};

export function LoyaltyStatCards({
  saldoLoyalti,
  stampGalon,
  stampClaimedCount,
  stampThreshold,
  nilaiGalonGratis,
  totalEarn,
  totalRedeem,
  earnList,
  redeemList,
  stampList,
  recentList,
}: Props) {
  const [open, setOpen] = useState<StatKind | null>(null);
  const [ref, setRef] = useState<{ kind: "order" | "transaksi"; id: number } | null>(null);

  const currentCycle = stampGalon % stampThreshold;
  const remaining = stampThreshold - currentCycle;
  const cyclePercent = Math.round((currentCycle / stampThreshold) * 100);

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={<Coins size={16} className="text-brand" />}
          label="Saldo Loyalty"
          value={formatRupiah(saldoLoyalti)}
          highlight
          onClick={() => setOpen("saldo")}
        />
        <StatCard
          icon={<Star size={16} className="text-amber-500" />}
          label="Stamp Galon"
          value={`${stampGalon}/${stampThreshold}`}
          onClick={() => setOpen("stamp")}
        />
        <StatCard
          icon={<TrendingUp size={16} className="text-emerald-600" />}
          label="Total Earn"
          value={formatRupiah(totalEarn)}
          onClick={() => setOpen("earn")}
        />
        <StatCard
          icon={<TrendingDown size={16} className="text-red-500" />}
          label="Total Redeem"
          value={formatRupiah(totalRedeem)}
          onClick={() => setOpen("redeem")}
        />
      </div>

      {open && (
        <DetailPanel onClose={() => setOpen(null)}>
          {open === "saldo" && (
            <SaldoDetail
              saldoLoyalti={saldoLoyalti}
              totalEarn={totalEarn}
              totalRedeem={totalRedeem}
              recentList={recentList}
              onOpenRef={setRef}
            />
          )}
          {open === "stamp" && (
            <StampDetail
              stampGalon={stampGalon}
              stampClaimedCount={stampClaimedCount}
              threshold={stampThreshold}
              nilaiGalonGratis={nilaiGalonGratis}
              currentCycle={currentCycle}
              remaining={remaining}
              cyclePercent={cyclePercent}
              stampList={stampList}
              onOpenRef={setRef}
            />
          )}
          {open === "earn" && (
            <MutasiList
              kind="earn"
              title="Detail Total Earn"
              subtitle="Semua saldo yang masuk (order, referral, adjust)"
              total={totalEarn}
              items={earnList}
              onOpenRef={setRef}
            />
          )}
          {open === "redeem" && (
            <MutasiList
              kind="redeem"
              title="Detail Total Redeem"
              subtitle="Semua saldo yang dipakai (diskon di order)"
              total={totalRedeem}
              items={redeemList}
              onOpenRef={setRef}
            />
          )}
        </DetailPanel>
      )}

      {ref && (
        <DetailModal kind={ref.kind} id={ref.id} onClose={() => setRef(null)} />
      )}
    </>
  );
}

function StatCard({
  icon,
  label,
  value,
  highlight,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left bg-surface border border-line rounded-2xl p-3 transition hover:border-brand hover:shadow-md active:scale-[0.98] cursor-pointer ${
        highlight ? "ring-2 ring-brand/40" : ""
      }`}
    >
      <div className="text-[10px] text-[color:var(--muted)] uppercase tracking-wide font-semibold inline-flex items-center gap-1">
        {icon} {label}
      </div>
      <div className="text-lg font-extrabold mt-1">{value}</div>
      <div className="text-[9px] text-brand mt-1 font-bold uppercase tracking-wider">
        Klik untuk detail →
      </div>
    </button>
  );
}

function DetailPanel({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface rounded-t-2xl sm:rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-surface border-b border-line px-4 py-3 flex items-center justify-between z-10">
          <div className="text-xs font-bold text-[color:var(--muted)] uppercase tracking-widest">
            Detail Loyalty
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-[color:var(--surface2)] rounded"
            aria-label="Tutup"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-4 space-y-3">{children}</div>
      </div>
    </div>
  );
}

function SaldoDetail({
  saldoLoyalti,
  totalEarn,
  totalRedeem,
  recentList,
  onOpenRef,
}: {
  saldoLoyalti: number;
  totalEarn: number;
  totalRedeem: number;
  recentList: MutasiRow[];
  onOpenRef: (ref: { kind: "order" | "transaksi"; id: number }) => void;
}) {
  return (
    <>
      <div className="bg-brand-soft border border-brand/20 rounded-2xl p-4 text-center">
        <div className="text-[10px] font-bold tracking-widest text-brand uppercase">
          Saldo Saat Ini
        </div>
        <div className="text-3xl font-extrabold text-brand mt-1">
          {formatRupiah(saldoLoyalti)}
        </div>
        <div className="text-[11px] text-[color:var(--muted)] mt-1">
          Bisa dipakai sebagai diskon di order berikutnya
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
          <div className="text-[10px] font-bold text-emerald-700 uppercase">
            Total Earn (all-time)
          </div>
          <div className="text-lg font-extrabold text-emerald-800 mt-0.5">
            +{formatRupiah(totalEarn)}
          </div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-3">
          <div className="text-[10px] font-bold text-red-700 uppercase">
            Total Redeem (all-time)
          </div>
          <div className="text-lg font-extrabold text-red-800 mt-0.5">
            −{formatRupiah(totalRedeem)}
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-xs font-bold text-[color:var(--muted)] uppercase tracking-widest mb-1.5">
          5 Mutasi Terakhir
        </h3>
        <MutasiRows items={recentList.slice(0, 5)} onOpenRef={onOpenRef} />
      </div>
    </>
  );
}

function StampDetail({
  stampGalon,
  stampClaimedCount,
  threshold,
  nilaiGalonGratis,
  currentCycle,
  remaining,
  cyclePercent,
  stampList,
  onOpenRef,
}: {
  stampGalon: number;
  stampClaimedCount: number;
  threshold: number;
  nilaiGalonGratis: number;
  currentCycle: number;
  remaining: number;
  cyclePercent: number;
  stampList: MutasiRow[];
  onOpenRef: (ref: { kind: "order" | "transaksi"; id: number }) => void;
}) {
  return (
    <>
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-bold tracking-widest text-amber-700 uppercase">
              Total Galon Sepanjang Masa
            </div>
            <div className="text-3xl font-extrabold text-amber-900 mt-1">
              {stampGalon} galon
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[10px] font-bold tracking-widest text-amber-700 uppercase">
              Reward Diraih
            </div>
            <div className="text-2xl font-extrabold text-amber-900 mt-1 inline-flex items-center gap-1">
              <Gift size={18} /> {stampClaimedCount}×
            </div>
          </div>
        </div>
      </div>

      <div className="bg-surface border border-line rounded-2xl p-4 space-y-2">
        <div className="text-xs font-bold">Progres Cycle Sekarang</div>
        <div className="flex justify-between text-[11px]">
          <span className="font-bold">
            {currentCycle}/{threshold} galon
          </span>
          <span className="text-[color:var(--muted)]">
            Sisa <b className="text-ink">{remaining} galon lagi</b> → +
            {formatRupiah(nilaiGalonGratis)}
          </span>
        </div>
        <div className="h-2 bg-[color:var(--surface2)] rounded-full overflow-hidden">
          <div
            className="h-full bg-amber-400 rounded-full transition-all"
            style={{ width: `${cyclePercent}%` }}
          />
        </div>
        <div className="text-[10px] text-[color:var(--muted)] italic">
          Setiap {threshold} galon = 1× galon gratis senilai{" "}
          {formatRupiah(nilaiGalonGratis)}
        </div>
      </div>

      <div>
        <h3 className="text-xs font-bold text-[color:var(--muted)] uppercase tracking-widest mb-1.5">
          Riwayat Klaim Reward ({stampList.length})
        </h3>
        {stampList.length === 0 ? (
          <div className="bg-[color:var(--surface2)] border border-line rounded-xl p-4 text-center text-xs text-[color:var(--muted)]">
            Belum pernah klaim reward stamp.
          </div>
        ) : (
          <MutasiRows items={stampList} onOpenRef={onOpenRef} />
        )}
      </div>
    </>
  );
}

function MutasiList({
  kind,
  title,
  subtitle,
  total,
  items,
  onOpenRef,
}: {
  kind: "earn" | "redeem";
  title: string;
  subtitle: string;
  total: number;
  items: MutasiRow[];
  onOpenRef: (ref: { kind: "order" | "transaksi"; id: number }) => void;
}) {
  const bg = kind === "earn" ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200";
  const textColor = kind === "earn" ? "text-emerald-900" : "text-red-900";
  const labelColor = kind === "earn" ? "text-emerald-700" : "text-red-700";
  return (
    <>
      <div className={`${bg} border rounded-2xl p-4 text-center`}>
        <div className={`text-[10px] font-bold tracking-widest ${labelColor} uppercase`}>
          {title}
        </div>
        <div className={`text-3xl font-extrabold mt-1 ${textColor}`}>
          {kind === "earn" ? "+" : "−"}
          {formatRupiah(total)}
        </div>
        <div className="text-[11px] text-[color:var(--muted)] mt-1">{subtitle}</div>
      </div>

      <div>
        <h3 className="text-xs font-bold text-[color:var(--muted)] uppercase tracking-widest mb-1.5">
          {items.length} Mutasi Terbaru
        </h3>
        {items.length === 0 ? (
          <div className="bg-[color:var(--surface2)] border border-line rounded-xl p-4 text-center text-xs text-[color:var(--muted)]">
            Belum ada mutasi {kind}.
          </div>
        ) : (
          <MutasiRows items={items} onOpenRef={onOpenRef} />
        )}
      </div>
    </>
  );
}

function MutasiRows({
  items,
  onOpenRef,
}: {
  items: MutasiRow[];
  onOpenRef: (ref: { kind: "order" | "transaksi"; id: number }) => void;
}) {
  return (
    <div className="bg-surface border border-line rounded-xl divide-y divide-line overflow-hidden">
      {items.map((m) => {
        const hasRef = !!(m.refOrderId || m.refTransaksiId);
        const label = TIPE_LABEL[m.tipe] ?? m.tipe;
        const positive = m.jumlah > 0;
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => {
              if (m.refOrderId) onOpenRef({ kind: "order", id: m.refOrderId });
              else if (m.refTransaksiId) onOpenRef({ kind: "transaksi", id: m.refTransaksiId });
            }}
            disabled={!hasRef}
            className={`w-full text-left px-3 py-2.5 flex items-start justify-between gap-2 ${
              hasRef ? "hover:bg-[color:var(--surface2)] cursor-pointer" : "cursor-default"
            }`}
          >
            <div className="min-w-0 flex-1">
              <div className="font-bold text-xs">
                {label}
                {hasRef && <span className="ml-1 text-brand">›</span>}
              </div>
              {m.deskripsi && (
                <div className="text-[10px] text-[color:var(--muted)] line-clamp-1">
                  {m.deskripsi}
                </div>
              )}
              <div className="text-[10px] text-[color:var(--muted)] mt-0.5">
                {new Date(m.createdAt).toLocaleString("id-ID", {
                  day: "2-digit",
                  month: "short",
                  year: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
            <div
              className={`text-sm font-extrabold whitespace-nowrap shrink-0 ${
                positive ? "text-emerald-600" : "text-red-600"
              }`}
            >
              {positive ? "+" : ""}
              {formatRupiah(m.jumlah)}
            </div>
          </button>
        );
      })}
    </div>
  );
}
