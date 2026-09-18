import Link from "next/link";
import {
  Truck,
  MapPin,
  Gift,
  CreditCard,
  MessageCircle,
  FileText,
  ArrowRight,
  Zap,
} from "lucide-react";
import { requireRole } from "@/lib/permissions";
import { NumberTicker } from "@/components/NumberTicker";
import { Spotlight } from "@/components/magic-ui/Spotlight";
import { Marquee } from "@/components/magic-ui/Marquee";
import { GallonArt, DropFill } from "@/components/GallonArt";

export const dynamic = "force-dynamic";

/**
 * PREVIEW B — Premium & Cinematic.
 * Dark hero + Spotlight effect + Bento Grid + Marquee testimonial.
 * Vibe: "premium water delivery, high-end". Cocok untuk RO/imported water
 * atau target market kelas menengah atas.
 */
export default async function PreviewLandingB() {
  await requireRole(["admin"]);

  return (
    <div className="min-h-screen bg-slate-950 text-white -m-4 md:-m-6 relative overflow-hidden">
      {/* Preview banner */}
      <div className="sticky top-0 z-40 bg-amber-950/50 border-b border-amber-500/30 px-4 py-2 text-xs text-amber-100 flex items-center justify-between backdrop-blur-lg">
        <div>
          <b>PREVIEW B — Premium & Cinematic</b> · Not live landing page
        </div>
        <Link href="/admin/preview/landing" className="font-bold hover:underline">
          ← Kembali
        </Link>
      </div>

      {/* Header */}
      <header className="sticky top-[33px] z-30 backdrop-blur-xl bg-slate-950/60 border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="inline-flex items-center gap-2.5">
            <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-brand text-white grid place-items-center shadow-lg shadow-cyan-500/30">
              <DropFill size={22} color="white" />
            </span>
            <div>
              <div className="font-extrabold text-base leading-tight tracking-tight">DEPOT GNR</div>
              <div className="text-[10px] text-cyan-300/70 leading-tight tracking-widest uppercase">
                Premium Water
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="px-3 sm:px-4 py-2 text-sm font-bold text-white/80 hover:text-white transition">
              Masuk
            </button>
            <button className="px-3 sm:px-4 py-2 bg-white text-slate-900 text-sm font-bold rounded-lg hover:bg-cyan-100 transition">
              Daftar
            </button>
          </div>
        </div>
      </header>

      {/* Hero — dark with Spotlight */}
      <section className="relative min-h-[600px] overflow-hidden">
        <Spotlight fill="#22d3ee" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(34,211,238,0.15),transparent_50%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-40" />

        <div className="relative max-w-6xl mx-auto px-4 py-20 md:py-28">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-1.5 border border-cyan-400/30 bg-cyan-400/5 text-cyan-300 text-xs font-bold tracking-widest uppercase px-4 py-2 rounded-full mb-8">
              <Zap size={12} /> Established water delivery · Kota Gorontalo
            </div>
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-[0.95] mb-6">
              Elevate your{" "}
              <span className="bg-gradient-to-r from-cyan-300 via-white to-cyan-300 bg-clip-text text-transparent">
                hydration
              </span>
              <br />
              experience.
            </h1>
            <p className="text-lg md:text-xl text-slate-300 max-w-2xl mx-auto mb-10 leading-relaxed">
              Air minum grade premium diantar dalam waktu 30 menit. Sistem tracking realtime,
              notifikasi instan, pengalaman servis tanpa kompromi.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button className="px-8 py-4 bg-white text-slate-900 font-extrabold rounded-xl hover:bg-cyan-100 transition inline-flex items-center justify-center gap-2 shadow-xl shadow-cyan-500/20">
                Get Started <ArrowRight size={18} />
              </button>
              <button className="px-8 py-4 border border-white/20 text-white font-extrabold rounded-xl hover:bg-white/5 transition inline-flex items-center justify-center gap-2 backdrop-blur">
                Sign In
              </button>
            </div>
          </div>

          {/* Floating stat cards */}
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            {[
              { value: 12000, suffix: "+", label: "Active users" },
              { value: 250000, suffix: "+", label: "Bottles delivered" },
              { value: 30, suffix: " min", label: "Average delivery" },
              { value: 99.9, decimals: 1, suffix: "%", label: "Uptime" },
            ].map((s) => (
              <div
                key={s.label}
                className="relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 hover:border-cyan-400/40 transition"
              >
                <div className="text-2xl md:text-3xl font-extrabold bg-gradient-to-r from-cyan-300 to-white bg-clip-text text-transparent">
                  <NumberTicker
                    value={s.value}
                    decimalPlaces={s.decimals ?? 0}
                    suffix={s.suffix}
                  />
                </div>
                <div className="text-[11px] text-slate-400 mt-1 uppercase tracking-wider">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bento benefits */}
      <section className="max-w-6xl mx-auto px-4 py-24 relative">
        <div className="text-center mb-12">
          <div className="text-xs font-bold tracking-widest text-cyan-400 uppercase mb-3">
            Everything you need
          </div>
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight">
            Built for excellence
          </h2>
        </div>

        {/* Bento grid — 3 col dengan varied tile sizes */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 auto-rows-[180px]">
          <div className="md:col-span-2 md:row-span-2 rounded-3xl border border-white/10 bg-gradient-to-br from-cyan-500/10 via-slate-900 to-slate-950 p-8 relative overflow-hidden group hover:border-cyan-400/30 transition">
            <div className="absolute -top-20 -right-20 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl group-hover:bg-cyan-500/20 transition" />
            <div className="relative">
              <div className="w-14 h-14 rounded-2xl bg-cyan-400/10 border border-cyan-400/30 grid place-items-center mb-6">
                <MapPin size={26} className="text-cyan-300" />
              </div>
              <h3 className="text-2xl md:text-3xl font-extrabold mb-3">Realtime tracking</h3>
              <p className="text-slate-400 max-w-md leading-relaxed">
                Lihat posisi kurir Anda di peta bergerak realtime. Notifikasi otomatis saat
                kurir sudah dekat. Tidak ada lagi menunggu di rumah tanpa kepastian.
              </p>
              <div className="absolute bottom-8 right-8 opacity-20 group-hover:opacity-40 transition">
                <GallonArt size={160} />
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-900/50 p-6 hover:border-cyan-400/30 transition">
            <Truck size={24} className="text-cyan-300 mb-4" />
            <h3 className="font-extrabold text-lg mb-2">Fast delivery</h3>
            <p className="text-sm text-slate-400">Rata-rata 30 menit ke lokasi Anda</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-900/50 p-6 hover:border-cyan-400/30 transition">
            <Gift size={24} className="text-cyan-300 mb-4" />
            <h3 className="font-extrabold text-lg mb-2">Cashback</h3>
            <p className="text-sm text-slate-400">Rp 500/galon otomatis masuk saldo</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-900/50 p-6 hover:border-cyan-400/30 transition">
            <CreditCard size={24} className="text-cyan-300 mb-4" />
            <h3 className="font-extrabold text-lg mb-2">Multi-payment</h3>
            <p className="text-sm text-slate-400">Cash, transfer, QRIS, DANA</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-900/50 p-6 hover:border-cyan-400/30 transition">
            <MessageCircle size={24} className="text-cyan-300 mb-4" />
            <h3 className="font-extrabold text-lg mb-2">WA notifications</h3>
            <p className="text-sm text-slate-400">Instant updates via WhatsApp</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-900/50 p-6 hover:border-cyan-400/30 transition">
            <FileText size={24} className="text-cyan-300 mb-4" />
            <h3 className="font-extrabold text-lg mb-2">Digital receipts</h3>
            <p className="text-sm text-slate-400">Semua nota tersimpan rapi</p>
          </div>
        </div>
      </section>

      {/* Marquee testimonial */}
      <section className="py-16 border-y border-white/10 bg-slate-900/30 overflow-hidden">
        <div className="text-center mb-10 px-4">
          <div className="text-xs font-bold tracking-widest text-cyan-400 uppercase mb-2">
            Loved by families
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold">Dipercaya ribuan keluarga</h2>
        </div>
        <Marquee className="[--duration:60s]" pauseOnHover>
          {[
            { name: "Ibu Rina", loc: "Perumnas 3", text: "Sekarang tidak perlu telepon tukang air. Order dari HP, kurir langsung datang." },
            { name: "Pak Yudi", loc: "Kel. Tenilo", text: "Cashback-nya lumayan. Sudah dapat 10rb ke saldo setelah 20 galon." },
            { name: "Ibu Maya", loc: "Kel. Pilolodaa", text: "Suka fitur trackingnya. Bisa siap-siap terima galon tanpa nunggu." },
            { name: "Pak Andri", loc: "Kel. Buliide", text: "Aplikasinya simple, bahkan orangtua saya bisa pakai sendiri." },
            { name: "Ibu Tia", loc: "Perum Harapan", text: "Notif WA-nya membantu. Tahu order sudah dijemput / diantar." },
          ].map((t) => (
            <div
              key={t.name}
              className="w-72 shrink-0 bg-slate-900 border border-white/10 rounded-2xl p-5 mx-2"
            >
              <div className="flex items-center gap-1 mb-3 text-amber-400">
                {"★★★★★".split("").map((s, i) => (
                  <span key={i}>{s}</span>
                ))}
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">&ldquo;{t.text}&rdquo;</p>
              <div className="mt-3 text-xs text-slate-400">
                <b className="text-white">{t.name}</b> · {t.loc}
              </div>
            </div>
          ))}
        </Marquee>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-4 py-20 text-center">
        <h2 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6">
          Ready to experience{" "}
          <span className="bg-gradient-to-r from-cyan-300 to-cyan-500 bg-clip-text text-transparent">
            premium water?
          </span>
        </h2>
        <p className="text-lg text-slate-400 mb-8">
          Bergabung dalam 60 detik. Bonus Rp 5.000 untuk order pertama Anda.
        </p>
        <button className="px-10 py-4 bg-gradient-to-r from-cyan-400 to-brand text-white font-extrabold rounded-xl hover:from-cyan-300 hover:to-brand transition inline-flex items-center gap-2 shadow-2xl shadow-cyan-500/30 text-base">
          Start now <ArrowRight size={20} />
        </button>
      </section>
    </div>
  );
}
