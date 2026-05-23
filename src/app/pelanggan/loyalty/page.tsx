import { eq, desc } from "drizzle-orm";
import { Sparkles, Droplet, Gift, ArrowRight } from "lucide-react";
import { db } from "@/db";
import { mutasiLoyalti } from "@/db/schema/pelanggan";
import { pengaturan } from "@/db/schema/pengaturan";
import { requireSession } from "@/lib/permissions";
import { getOrCreatePelanggan } from "@/lib/pelanggan";
import { formatRupiah } from "@/lib/utils";
import { ShareReferralButton } from "./ShareReferralButton";

export const dynamic = "force-dynamic";

const TIPE_LABEL: Record<string, string> = {
  earn: "Earn galon",
  redeem: "Pakai saldo",
  referral_in: "Bonus referral",
  referral_bonus: "Bonus mengajak",
  stamp_reward: "Galon gratis",
  adjust: "Penyesuaian",
};

const TIPE_ICON: Record<string, string> = {
  earn: "💧",
  redeem: "🛒",
  referral_in: "🎁",
  referral_bonus: "🤝",
  stamp_reward: "🎉",
  adjust: "⚙️",
};

export default async function LoyaltyPage() {
  const session = await requireSession();
  const me = await getOrCreatePelanggan(session.user.id, session.user.name);

  const history = await db
    .select()
    .from(mutasiLoyalti)
    .where(eq(mutasiLoyalti.pelangganId, me.id))
    .orderBy(desc(mutasiLoyalti.createdAt))
    .limit(50);

  const cfg = await db.query.pengaturan.findMany();
  const cfgMap = Object.fromEntries(cfg.map((r) => [r.key, r.value ?? ""]));
  const stampAktif = (cfgMap.aktifkanStampGalon ?? "1") !== "0";
  const threshold = Math.max(1, Number(cfgMap.stampThresholdGalon) || 10);
  const nilai = Math.max(0, Number(cfgMap.nilaiGalonGratis) || 5_000);
  const stampNow = me.stampGalon % threshold;
  const stampPercent = Math.round((stampNow / threshold) * 100);

  return (
    <div>
      {/* Hero with gradient */}
      <div
        className="-mx-4 sm:mx-0 sm:rounded-3xl px-5 pt-5 pb-7 text-white relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, var(--accent2), var(--brand))",
        }}
      >
        <Sparkles
          size={180}
          className="absolute -right-8 -top-8 opacity-15"
          strokeWidth={1}
        />
        <h1 className="text-2xl font-extrabold tracking-tight">Reward GNR</h1>

        <div className="mt-5 p-5 rounded-2xl backdrop-blur-md bg-white/20">
          <div className="text-[11px] font-bold tracking-widest opacity-85">
            SALDO LOYALTY
          </div>
          <div className="text-4xl font-extrabold tracking-tight mt-1">
            {formatRupiah(me.saldoLoyalti)}
          </div>
          <div className="text-xs opacity-85 mt-1">
            Bisa dipakai sebagai diskon di order/POS berikutnya
          </div>
          {stampAktif && (
            <div className="mt-4">
              <div className="flex justify-between text-[11px] font-semibold mb-1.5">
                <span>
                  {stampNow}/{threshold} galon
                </span>
                <span>
                  {threshold - stampNow} lagi → +{formatRupiah(nilai)}
                </span>
              </div>
              <div className="h-2 bg-white/25 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white rounded-full transition-all"
                  style={{ width: `${stampPercent}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stamp Card Visual — 10 dots */}
      {stampAktif && (
        <section className="bg-surface border border-line rounded-2xl p-4 mt-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h2 className="font-extrabold inline-flex items-center gap-1.5">
                <Droplet size={16} className="text-brand" /> Kartu Stempel Galon
              </h2>
              <p className="text-[11px] text-[color:var(--muted)] mt-0.5">
                Setiap {threshold} galon = gratis 1 galon ({formatRupiah(nilai)})
              </p>
            </div>
            {stampNow >= Math.ceil(threshold * 0.8) && stampNow < threshold && (
              <span className="text-[10px] px-2 py-1 bg-amber-100 text-amber-800 rounded-full font-bold animate-pulse">
                🔥 Hampir dapat!
              </span>
            )}
          </div>

          {/* Grid stempel — adaptif: kalau threshold > 10 pakai 2 baris */}
          <div
            className={`grid gap-1.5 ${
              threshold <= 10 ? "grid-cols-10" : threshold <= 12 ? "grid-cols-6" : "grid-cols-5"
            }`}
          >
            {Array.from({ length: threshold }).map((_, i) => {
              const filled = i < stampNow;
              const isLast = i === threshold - 1;
              return (
                <div
                  key={i}
                  className={`aspect-square rounded-lg grid place-items-center text-base transition ${
                    filled
                      ? isLast
                        ? "bg-amber-400 text-white shadow-md ring-2 ring-amber-300"
                        : "bg-brand text-white shadow-sm"
                      : "bg-[color:var(--surface2)] text-[color:var(--muted)]/40 border-2 border-dashed border-line"
                  }`}
                >
                  {filled ? (isLast ? "🎁" : "💧") : ""}
                </div>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between text-xs">
            <span className="font-bold">
              {stampNow}/{threshold} stempel
            </span>
            <span className="text-[color:var(--muted)]">
              Sisa <b className="text-ink">{threshold - stampNow} galon lagi</b>
            </span>
          </div>
        </section>
      )}

      {/* Stats stamp */}
      {stampAktif && (
        <div className="grid grid-cols-2 gap-2 mt-3">
          <div className="bg-surface border border-line rounded-2xl p-4">
            <div className="w-9 h-9 rounded-xl bg-brand-soft text-brand grid place-items-center">
              <Droplet size={18} />
            </div>
            <div className="text-[10px] text-[color:var(--muted)] mt-2 font-semibold uppercase tracking-wide">
              Total Galon
            </div>
            <div className="text-2xl font-extrabold">{me.stampGalon}</div>
          </div>
          <div className="bg-surface border border-line rounded-2xl p-4">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 grid place-items-center">
              <Gift size={18} />
            </div>
            <div className="text-[10px] text-[color:var(--muted)] mt-2 font-semibold uppercase tracking-wide">
              Reward Diraih
            </div>
            <div className="text-2xl font-extrabold">{me.stampClaimedCount}×</div>
          </div>
        </div>
      )}

      {/* Referral section */}
      <section className="mt-4">
        <div className="bg-surface border border-line rounded-2xl p-4 space-y-3">
          <div>
            <div className="text-[11px] font-bold tracking-widest text-[color:var(--muted)]">
              KODE REFERRAL ANDA
            </div>
            <div className="mt-1.5 bg-[color:var(--accent)]/30 rounded-xl py-3 px-4 text-center">
              <div className="text-[10px] text-ink/70 font-semibold">
                Bagikan ke teman:
              </div>
              <div className="text-3xl font-mono font-extrabold tracking-widest text-ink mt-0.5">
                {me.kodeReferral ?? "—"}
              </div>
            </div>
          </div>
          <div className="text-xs text-[color:var(--muted)]">
            Setiap teman daftar pakai kode ini & order pertama lunas, Anda dapat{" "}
            <b className="text-ink">Rp 5.000</b> saldo, teman juga dapat{" "}
            <b className="text-ink">Rp 5.000</b>.
          </div>
          {me.kodeReferral && <ShareReferralButton kode={me.kodeReferral} nama={me.nama} />}
        </div>
      </section>

      {/* History */}
      <section className="mt-4 mb-4">
        <h2 className="text-base font-extrabold mb-2 px-1">Riwayat Saldo</h2>
        <div className="bg-surface border border-line rounded-2xl overflow-hidden">
          {history.length === 0 ? (
            <div className="text-sm text-[color:var(--muted)] py-8 text-center">
              Belum ada riwayat. Mulai pesan air untuk dapat poin!
            </div>
          ) : (
            <div className="divide-y divide-line">
              {history.map((h) => (
                <div key={h.id} className="py-3 px-4 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="text-2xl flex-shrink-0">
                      {TIPE_ICON[h.tipe] ?? "•"}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-sm">
                        {TIPE_LABEL[h.tipe] ?? h.tipe}
                      </div>
                      {h.deskripsi && (
                        <div className="text-xs text-[color:var(--muted)] line-clamp-2">
                          {h.deskripsi}
                        </div>
                      )}
                      <div className="text-[10px] text-[color:var(--muted)] mt-0.5">
                        {new Date(h.createdAt).toLocaleString("id-ID", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                  </div>
                  <div
                    className={`text-sm font-extrabold whitespace-nowrap flex-shrink-0 ${
                      h.jumlah > 0
                        ? "text-emerald-600"
                        : "text-[color:var(--accent2)]"
                    }`}
                  >
                    {h.jumlah > 0 ? "+" : ""}
                    {formatRupiah(h.jumlah)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
