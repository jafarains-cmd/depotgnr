import Link from "next/link";
import {
  Truck,
  MapPin,
  Gift,
  CreditCard,
  MessageCircle,
  FileText,
  Sparkles,
  ArrowRight,
  Star,
} from "lucide-react";
import { requireRole } from "@/lib/permissions";
import { NumberTicker } from "@/components/NumberTicker";
import { BorderBeam } from "@/components/magic-ui/BorderBeam";
import { GallonArt, DropFill } from "@/components/GallonArt";

export const dynamic = "force-dynamic";

/**
 * PREVIEW A — Clean & Trustworthy.
 * Light theme, soft aqua brand, minimal animation. Vibe "aman dipesan
 * mama-mama komplek". Cocok untuk pelanggan reguler UMKM.
 */
export default async function PreviewLandingA() {
  await requireRole(["admin"]);

  return (
    <div className="min-h-screen bg-white text-slate-900 -m-4 md:-m-6 relative overflow-hidden">
      {/* Sticky preview banner */}
      <div className="sticky top-0 z-40 bg-blue-50 border-b border-blue-200 px-4 py-2 text-xs text-blue-800 flex items-center justify-between">
        <div>
          <b>PREVIEW A — Clean & Trustworthy</b> · Not live landing page
        </div>
        <Link href="/admin/preview/landing" className="font-bold hover:underline">
          ← Kembali
        </Link>
      </div>

      {/* Header */}
      <header className="bg-white border-b border-slate-100 sticky top-[33px] z-30 backdrop-blur-lg bg-white/80">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="inline-flex items-center gap-2.5">
            <span className="w-10 h-10 rounded-xl bg-brand text-white grid place-items-center">
              <DropFill size={22} color="white" />
            </span>
            <div>
              <div className="font-extrabold text-base leading-tight">DEPOT GNR</div>
              <div className="text-[10px] text-slate-500 leading-tight">Air Isi Ulang</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="px-3 sm:px-4 py-2 text-sm font-bold text-brand hover:bg-brand-soft rounded-lg transition">
              Masuk
            </button>
            <button className="px-3 sm:px-4 py-2 bg-brand text-white text-sm font-bold rounded-lg hover:bg-brand-deep transition shadow-sm">
              Daftar
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-white via-brand-soft/30 to-white">
        <div className="max-w-6xl mx-auto px-4 py-14 md:py-24">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <div className="text-center lg:text-left">
              <div className="inline-flex items-center gap-1.5 bg-white border border-brand/20 text-brand text-xs font-extrabold tracking-widest uppercase px-3 py-1.5 rounded-full mb-5 shadow-sm">
                <Sparkles size={12} /> Terpercaya sejak 2020
              </div>
              <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-[1.05] mb-5 text-slate-900">
                Air minum <span className="text-brand">berkualitas</span>,
                <br />
                antar dalam <span className="text-brand">30 menit</span>.
              </h1>
              <p className="text-base md:text-lg text-slate-600 max-w-xl mx-auto lg:mx-0 mb-7 leading-relaxed">
                Pesan galon isi ulang dari depot terdekat. Sudah dipercaya ribuan keluarga
                di Kota Gorontalo. Antar cepat, harga jujur, lacak realtime.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
                <div className="relative rounded-xl overflow-hidden">
                  <button className="relative w-full px-6 py-3.5 bg-brand text-white font-extrabold rounded-xl hover:bg-brand-deep transition inline-flex items-center justify-center gap-2 shadow-lg shadow-brand/30">
                    Mulai Sekarang <ArrowRight size={18} />
                  </button>
                  <BorderBeam size={80} duration={12} colorFrom="#a5f3fc" colorTo="#0284c7" />
                </div>
                <button className="px-6 py-3.5 bg-white text-slate-900 font-extrabold rounded-xl hover:bg-slate-50 transition inline-flex items-center justify-center gap-2 shadow-sm border border-slate-200">
                  Sudah Punya Akun
                </button>
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-4 text-xs text-slate-500 justify-center lg:justify-start">
                <div className="inline-flex items-center gap-1">
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star key={i} size={14} className="fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <span className="font-bold text-slate-700">4.9/5</span>
                  <span>· 500+ ulasan</span>
                </div>
                <span>✓ COD tersedia</span>
                <span>✓ Cashback Rp 500/galon</span>
              </div>
            </div>

            {/* Hero image */}
            <div className="relative">
              <div className="aspect-square max-w-md mx-auto bg-gradient-to-br from-brand-soft via-white to-brand-soft rounded-[2rem] grid place-items-center shadow-xl shadow-brand/10">
                <GallonArt size={220} />
              </div>
              <div className="absolute top-4 right-4 bg-white rounded-2xl shadow-lg p-3 max-w-[200px] border border-slate-100">
                <div className="text-[10px] font-extrabold text-emerald-700 uppercase tracking-wider">
                  ✓ Terkirim
                </div>
                <div className="text-xs font-bold mt-1">Pesanan diantar &lt;30 menit</div>
              </div>
              <div className="absolute bottom-4 left-4 bg-white rounded-2xl shadow-lg p-3 max-w-[200px] border border-slate-100">
                <div className="text-[10px] font-extrabold text-brand uppercase tracking-wider">
                  🎁 Cashback
                </div>
                <div className="text-xs font-bold mt-1">Rp 500/galon ke saldo</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stat bar */}
      <section className="border-y border-slate-100 bg-slate-50/50">
        <div className="max-w-5xl mx-auto px-4 py-8 grid grid-cols-2 md:grid-cols-4 gap-5 text-center">
          {[
            { value: 12000, suffix: "+", label: "Pelanggan aktif" },
            { value: 250000, suffix: "+", label: "Galon terkirim" },
            { value: 30, suffix: " menit", label: "Rata-rata antar" },
            { value: 4.9, decimals: 1, suffix: "/5", label: "Rating pelanggan" },
          ].map((s) => (
            <div key={s.label}>
              <div className="text-2xl md:text-3xl font-extrabold text-brand">
                <NumberTicker
                  value={s.value}
                  decimalPlaces={s.decimals ?? 0}
                  suffix={s.suffix}
                />
              </div>
              <div className="text-xs text-slate-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Benefits */}
      <section className="max-w-6xl mx-auto px-4 py-16 md:py-24">
        <div className="text-center mb-10">
          <div className="text-xs font-extrabold tracking-widest text-brand uppercase mb-2">
            Kenapa pilih kami?
          </div>
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            Semua jadi lebih mudah
          </h2>
          <p className="text-sm md:text-base text-slate-600 mt-2 max-w-xl mx-auto">
            Tidak perlu antri, tidak perlu telepon, tidak perlu hafal nomor tukang air.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { icon: Truck, title: "Antar Sampai Rumah", desc: "Order dari HP, kurir datang. Cocok yang sibuk atau ibu rumah tangga." },
            { icon: MapPin, title: "Lacak Kurir Realtime", desc: "Lihat posisi kurir di peta, siap-siap terima air." },
            { icon: Gift, title: "Cashback Setiap Order", desc: "Rp 500/galon masuk saldo loyalty. Bisa potong harga next order." },
            { icon: CreditCard, title: "Bayar Fleksibel", desc: "Cash COD, transfer bank, QRIS, atau DANA." },
            { icon: MessageCircle, title: "Notif WhatsApp", desc: "Update status langsung ke WA. Dari pesan dibuat sampai sampai." },
            { icon: FileText, title: "Riwayat & Nota", desc: "Semua order tersimpan rapi. Cetak nota untuk arsip kantor." },
          ].map((b) => {
            const Icon = b.icon;
            return (
              <div
                key={b.title}
                className="group bg-white border border-slate-200 rounded-2xl p-5 hover:border-brand hover:shadow-lg hover:shadow-brand/5 transition"
              >
                <div className="w-11 h-11 rounded-xl bg-brand-soft text-brand grid place-items-center group-hover:bg-brand group-hover:text-white transition">
                  <Icon size={22} />
                </div>
                <h3 className="font-extrabold text-base mt-3">{b.title}</h3>
                <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">{b.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-4 pb-16">
        <div className="rounded-3xl bg-gradient-to-br from-brand via-brand to-brand-deep p-10 md:p-16 text-center text-white relative overflow-hidden">
          <div className="absolute inset-0 opacity-20 pointer-events-none">
            <div className="absolute top-4 right-4 w-40 h-40 rounded-full bg-white blur-3xl" />
            <div className="absolute bottom-4 left-4 w-40 h-40 rounded-full bg-white blur-3xl" />
          </div>
          <div className="relative max-w-2xl mx-auto">
            <div className="inline-block bg-white/20 backdrop-blur text-[11px] font-extrabold tracking-widest uppercase px-3 py-1.5 rounded-full mb-4">
              ★ Pelanggan baru ★
            </div>
            <h2 className="text-3xl md:text-5xl font-extrabold mb-4 leading-tight">
              Bonus Rp 5.000 untuk daftar hari ini
            </h2>
            <p className="text-base md:text-lg opacity-95 mb-8">
              Saldo loyalty otomatis masuk setelah order pertama. Plus dapat kode referral untuk ajak teman.
            </p>
            <button className="inline-flex items-center gap-2 px-8 py-4 bg-white text-brand-deep font-extrabold rounded-xl hover:bg-slate-50 transition shadow-lg text-base">
              Klaim Bonus Saya <ArrowRight size={20} />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
