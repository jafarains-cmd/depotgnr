import { eq, desc } from "drizzle-orm";
import { Gift, Share2 } from "lucide-react";
import { db } from "@/db";
import { mutasiLoyalti } from "@/db/schema/pelanggan";
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
