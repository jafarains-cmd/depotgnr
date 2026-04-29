import { eq, desc } from "drizzle-orm";
import { Gift, Share2, Droplet } from "lucide-react";
import { db } from "@/db";
import { mutasiLoyalti } from "@/db/schema/pelanggan";
import { pengaturan } from "@/db/schema/pengaturan";
import { requireSession } from "@/lib/permissions";
import { getOrCreatePelanggan } from "@/lib/pelanggan";
import { formatRupiah } from "@/lib/utils";
import { ShareReferralButton } from "./ShareReferralButton";

export const dynamic = "force-dynamic";

const TIPE_LABEL: Record<string, string> = {
  earn: "Earn",
  redeem: "Redeem",
  referral_in: "Bonus Referral",
  referral_bonus: "Bonus Mengajak",
  stamp_reward: "Bonus Galon Gratis",
  adjust: "Penyesuaian",
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
  const stampToNext = threshold - stampNow;

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-brand-600 to-brand-700 text-white rounded-2xl p-5">
        <div className="text-sm opacity-80 inline-flex items-center gap-1.5">
          <Gift size={14} /> Saldo Loyalty
        </div>
        <div className="text-3xl font-bold mt-1">{formatRupiah(me.saldoLoyalti)}</div>
        <div className="text-xs opacity-80 mt-2">
          Dapat Rp 250/galon (antar) · Rp 500/galon (datang ke depot). Pakai saat checkout.
        </div>
      </div>

      {stampAktif && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="text-sm font-semibold inline-flex items-center gap-1.5">
            <Droplet size={16} /> Stamp Galon Gratis
          </div>
          <div className="text-xs text-slate-600">
            Setiap <b>{threshold} galon</b> Anda dapat <b>{formatRupiah(nilai)}</b> saldo loyalty (= 1 galon gratis).
          </div>
          <div>
            <div className="flex justify-between text-xs text-slate-500 mb-1">
              <span>
                {stampNow}/{threshold} galon
              </span>
              <span>{stampToNext} lagi untuk reward berikutnya</span>
            </div>
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-400 to-brand-600 transition-all"
                style={{ width: `${(stampNow / threshold) * 100}%` }}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="bg-slate-50 rounded p-2">
              <div className="text-[10px] text-slate-500">Total Galon</div>
              <div className="font-bold text-lg">{me.stampGalon}</div>
            </div>
            <div className="bg-slate-50 rounded p-2">
              <div className="text-[10px] text-slate-500">Reward Diraih</div>
              <div className="font-bold text-lg">{me.stampClaimedCount}×</div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="text-sm font-semibold inline-flex items-center gap-1.5">
          <Share2 size={16} /> Kode Referral Anda
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded p-3 text-center">
          <div className="text-xs text-amber-800">Bagikan ke teman:</div>
          <div className="text-2xl font-mono font-bold text-amber-900 my-1">
            {me.kodeReferral ?? "-"}
          </div>
        </div>
        <div className="text-xs text-slate-600">
          Setiap teman yang daftar pakai kode ini & order pertama lunas, Anda dapat{" "}
          <b>Rp 5.000</b> saldo, teman juga dapat <b>Rp 5.000</b>.
        </div>
        {me.kodeReferral && <ShareReferralButton kode={me.kodeReferral} nama={me.nama} />}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="text-sm font-semibold mb-2">Riwayat Saldo</div>
        {history.length === 0 ? (
          <div className="text-sm text-slate-400 py-4 text-center">Belum ada riwayat.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {history.map((h) => (
              <div key={h.id} className="py-2 flex items-start justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <div className="font-medium">{TIPE_LABEL[h.tipe] ?? h.tipe}</div>
                  {h.deskripsi && (
                    <div className="text-xs text-slate-500 truncate">{h.deskripsi}</div>
                  )}
                  <div className="text-xs text-slate-400">
                    {new Date(h.createdAt).toLocaleString("id-ID", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </div>
                </div>
                <div
                  className={`text-sm font-semibold whitespace-nowrap ${
                    h.jumlah > 0 ? "text-emerald-700" : "text-red-600"
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
    </div>
  );
}
