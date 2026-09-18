import Link from "next/link";
import {
  Truck,
  MapPin,
  Gift,
  Smile,
  Heart,
  Sparkles,
  ArrowRight,
  Zap,
} from "lucide-react";
import { requireRole } from "@/lib/permissions";
import { NumberTicker } from "@/components/NumberTicker";
import { Marquee } from "@/components/magic-ui/Marquee";
import { GallonArt, DropFill } from "@/components/GallonArt";

export const dynamic = "force-dynamic";

/**
 * PREVIEW C — Playful & Friendly.
 * Colorful (bukan cuma aqua), animated icons, chunky buttons dengan bounce,
 * cartoon-style illustrations pakai emoji/abstract shapes.
 * Vibe: "orang biasa buat orang biasa". Cocok mass market Indonesia.
 */
export default async function PreviewLandingC() {
  await requireRole(["admin"]);

  return (
    <div className="min-h-screen bg-amber-50 text-slate-900 -m-4 md:-m-6 relative overflow-hidden">
      {/* Preview banner */}
      <div className="sticky top-0 z-40 bg-fuchsia-100 border-b-2 border-fuchsia-300 px-4 py-2 text-xs text-fuchsia-900 flex items-center justify-between">
        <div>
          <b>PREVIEW C — Playful & Friendly</b> · Not live landing page
        </div>
        <Link href="/admin/preview/landing" className="font-bold hover:underline">
          ← Kembali
        </Link>
      </div>

      {/* Playful header */}
      <header className="bg-white/70 backdrop-blur sticky top-[33px] z-30 border-b-2 border-slate-200/60">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="inline-flex items-center gap-2.5">
            <span className="w-11 h-11 rounded-2xl bg-gradient-to-br from-brand to-cyan-400 text-white grid place-items-center rotate-[-6deg] shadow-lg">
              <DropFill size={22} color="white" />
            </span>
            <div>
              <div className="font-extrabold text-base leading-tight">DEPOT GNR</div>
              <div className="text-[10px] font-bold text-brand leading-tight">💧 Air segar tiap hari!</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="px-3 sm:px-4 py-2 text-sm font-bold text-brand hover:bg-brand-soft rounded-full transition">
              Masuk
            </button>
            <button className="px-4 py-2 bg-brand text-white text-sm font-extrabold rounded-full hover:bg-brand-deep transition shadow-md hover:scale-105 duration-200">
              Daftar
            </button>
          </div>
        </div>
      </header>

      {/* Hero — bright colorful */}
      <section className="relative overflow-hidden">
        {/* Playful floating shapes */}
        <div className="absolute inset-0 pointer-events-none opacity-40">
          <div className="absolute top-10 left-10 w-40 h-40 rounded-full bg-brand blur-3xl animate-float-slow" />
          <div className="absolute top-40 right-20 w-32 h-32 rounded-full bg-fuchsia-300 blur-3xl animate-float-slow" style={{ animationDelay: "1s" }} />
          <div className="absolute bottom-20 left-1/3 w-32 h-32 rounded-full bg-amber-300 blur-3xl animate-float-slow" style={{ animationDelay: "2s" }} />
        </div>

        <div className="max-w-6xl mx-auto px-4 py-14 md:py-24 relative">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <div className="text-center lg:text-left">
              <div className="inline-flex items-center gap-1.5 bg-fuchsia-100 border-2 border-fuchsia-300 text-fuchsia-900 text-xs font-extrabold uppercase px-4 py-1.5 rounded-full mb-5">
                <Sparkles size={12} /> Kado untuk mama komplek 🎉
              </div>
              <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-[1.05] mb-5">
                Air minum{" "}
                <span className="relative inline-block">
                  <span className="relative z-10">segar</span>,
                  <span className="absolute -bottom-1 left-0 right-0 h-3 bg-amber-300 -z-0" />
                </span>
                <br />
                antar cepat{" "}
                <span className="relative inline-block">
                  <span className="relative z-10">tanpa ribet</span>
                  <span className="absolute -bottom-1 left-0 right-0 h-3 bg-brand-soft -z-0" />
                </span>
                !
              </h1>
              <p className="text-base md:text-lg text-slate-700 max-w-xl mx-auto lg:mx-0 mb-7 leading-relaxed">
                Pesan galon isi ulang cuma dari HP. Kurir kami langsung meluncur ke rumah 🛵
                Cocok buat ibu-ibu sibuk, mahasiswa males, siapa aja yang mager keluar 😄
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
                <button className="px-8 py-4 bg-gradient-to-br from-brand to-cyan-500 text-white font-extrabold rounded-2xl hover:from-brand-deep hover:to-brand transition inline-flex items-center justify-center gap-2 shadow-xl shadow-brand/40 hover:scale-105 duration-200 text-base">
                  Mulai Pesan Sekarang <ArrowRight size={20} />
                </button>
                <button className="px-8 py-4 bg-white text-slate-900 font-extrabold rounded-2xl hover:bg-slate-50 transition inline-flex items-center justify-center gap-2 shadow-md border-2 border-slate-200 hover:scale-105 duration-200">
                  Sudah Punya Akun 👋
                </button>
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-3 justify-center lg:justify-start text-sm">
                <span className="inline-flex items-center gap-1 font-bold text-slate-700">🎁 Bonus Rp 5.000</span>
                <span className="text-slate-400">·</span>
                <span className="inline-flex items-center gap-1 font-bold text-slate-700">🚀 Antar 30 menit</span>
                <span className="text-slate-400">·</span>
                <span className="inline-flex items-center gap-1 font-bold text-slate-700">💧 Cashback tiap galon</span>
              </div>
            </div>

            {/* Hero — chunky playful */}
            <div className="relative">
              <div className="aspect-square max-w-md mx-auto bg-gradient-to-br from-brand via-cyan-300 to-fuchsia-300 rounded-[3rem] grid place-items-center shadow-2xl shadow-brand/30 rotate-[-3deg] hover:rotate-0 transition duration-500">
                <div className="bg-white rounded-[2.5rem] p-8 shadow-inner">
                  <GallonArt size={200} />
                </div>
              </div>

              {/* Stickers around */}
              <div className="absolute -top-4 -left-4 bg-amber-300 rounded-2xl px-4 py-2 shadow-lg rotate-[-8deg] font-extrabold text-slate-900 text-sm">
                💯 Trusted!
              </div>
              <div className="absolute top-10 -right-4 bg-fuchsia-400 rounded-2xl px-4 py-2 shadow-lg rotate-[6deg] font-extrabold text-white text-sm">
                🚚 Cepat!
              </div>
              <div className="absolute -bottom-2 left-1/4 bg-emerald-400 rounded-2xl px-4 py-2 shadow-lg rotate-[-5deg] font-extrabold text-white text-sm">
                ✨ Enak!
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stat bar */}
      <section className="bg-white/60 backdrop-blur border-y-2 border-white">
        <div className="max-w-5xl mx-auto px-4 py-10 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { value: 12000, suffix: "+", label: "Pelanggan 😊", color: "text-brand" },
            { value: 250000, suffix: "+", label: "Galon terkirim 🚚", color: "text-fuchsia-600" },
            { value: 30, suffix: " menit", label: "Antar cepat ⚡", color: "text-amber-600" },
            { value: 4.9, decimals: 1, suffix: "/5", label: "Rating pelanggan ⭐", color: "text-emerald-600" },
          ].map((s) => (
            <div key={s.label}>
              <div className={`text-3xl md:text-4xl font-extrabold ${s.color}`}>
                <NumberTicker
                  value={s.value}
                  decimalPlaces={s.decimals ?? 0}
                  suffix={s.suffix}
                />
              </div>
              <div className="text-xs md:text-sm text-slate-600 mt-1 font-bold">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works — playful flow */}
      <section className="max-w-6xl mx-auto px-4 py-16 md:py-20">
        <div className="text-center mb-12">
          <div className="text-xs font-extrabold tracking-widest text-fuchsia-600 uppercase mb-2">
            Gampang banget!
          </div>
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight">
            3 langkah, air sampai rumah
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6 relative">
          {[
            { icon: "📱", title: "Buka HP", desc: "Pilih galon, jumlah, alamat. Kurang dari 1 menit selesai.", bg: "bg-brand-soft", ring: "ring-brand" },
            { icon: "🛵", title: "Kurir Meluncur", desc: "Lihat posisi kurir di peta. Notif WA otomatis update status.", bg: "bg-fuchsia-100", ring: "ring-fuchsia-400" },
            { icon: "💧", title: "Air Sampai!", desc: "Bayar (COD/transfer). Selesai! Cashback masuk saldo loyalty.", bg: "bg-amber-100", ring: "ring-amber-400" },
          ].map((s, i) => (
            <div
              key={s.title}
              className={`relative ${s.bg} rounded-3xl p-8 text-center hover:scale-105 hover:-rotate-1 transition duration-300 shadow-lg ring-2 ${s.ring}`}
            >
              <div className="text-6xl mb-4">{s.icon}</div>
              <div className="inline-block px-3 py-1 rounded-full bg-white/70 text-xs font-extrabold mb-3">
                Langkah {i + 1}
              </div>
              <h3 className="font-extrabold text-xl mb-2">{s.title}</h3>
              <p className="text-sm text-slate-700 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Benefits chunky cards */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            Bonus fitur asik lainnya
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: Truck, title: "Antar Kilat", desc: "30 menit sampai!", bg: "bg-brand", text: "text-white" },
            { icon: MapPin, title: "Lacak Kurir", desc: "Lihat di peta realtime", bg: "bg-fuchsia-500", text: "text-white" },
            { icon: Gift, title: "Loyalty Poin", desc: "Cashback tiap galon", bg: "bg-amber-400", text: "text-slate-900" },
            { icon: Heart, title: "Ramah Kantong", desc: "Harga bersahabat", bg: "bg-emerald-500", text: "text-white" },
          ].map((b) => {
            const Icon = b.icon;
            return (
              <div
                key={b.title}
                className={`${b.bg} ${b.text} rounded-3xl p-6 hover:scale-105 hover:-rotate-2 transition duration-300 shadow-lg`}
              >
                <div className="w-12 h-12 rounded-2xl bg-white/20 grid place-items-center mb-4">
                  <Icon size={24} />
                </div>
                <h3 className="font-extrabold text-lg mb-1">{b.title}</h3>
                <p className="text-sm opacity-90">{b.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Marquee testimonial — playful stickers */}
      <section className="py-14 overflow-hidden">
        <div className="text-center mb-8 px-4">
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            Kata mereka yang udah nyoba 👇
          </h2>
        </div>
        <Marquee className="[--duration:50s]" pauseOnHover>
          {[
            { emoji: "😍", name: "Ibu Rina", text: "Sekarang nggak perlu telepon tukang air, order dari HP aja!", bg: "bg-brand-soft" },
            { emoji: "🥰", name: "Pak Yudi", text: "Cashback lumayan, dah dapet 10rb dari 20 galon.", bg: "bg-amber-100" },
            { emoji: "😊", name: "Ibu Maya", text: "Trackingnya keren! Bisa siap-siap sebelum kurir datang.", bg: "bg-fuchsia-100" },
            { emoji: "🤩", name: "Pak Andri", text: "Simple banget, orangtua saya aja bisa pake sendiri.", bg: "bg-emerald-100" },
            { emoji: "💕", name: "Ibu Tia", text: "Notif WA-nya membantu, tahu status order tanpa buka app.", bg: "bg-blue-100" },
          ].map((t) => (
            <div
              key={t.name}
              className={`w-72 shrink-0 ${t.bg} border-2 border-white rounded-3xl p-5 mx-2 shadow-md rotate-[-1deg] hover:rotate-0 hover:scale-105 transition`}
            >
              <div className="text-4xl mb-2">{t.emoji}</div>
              <p className="text-sm text-slate-800 leading-relaxed mb-3 font-medium">
                &ldquo;{t.text}&rdquo;
              </p>
              <div className="text-xs text-slate-700 font-bold">— {t.name}</div>
            </div>
          ))}
        </Marquee>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <div className="rounded-[3rem] bg-gradient-to-br from-brand via-fuchsia-500 to-amber-400 p-10 md:p-16 text-center text-white relative overflow-hidden">
          <div className="relative max-w-2xl mx-auto">
            <div className="text-5xl mb-4">🎁</div>
            <h2 className="text-3xl md:text-5xl font-extrabold mb-4 leading-tight">
              Bonus Rp 5.000 buat kamu!
            </h2>
            <p className="text-base md:text-lg opacity-95 mb-8">
              Daftar sekarang, saldo langsung masuk. Order pertama langsung dapat cashback lagi 🥳
            </p>
            <button className="inline-flex items-center gap-2 px-10 py-4 bg-white text-slate-900 font-extrabold rounded-2xl hover:scale-105 hover:bg-slate-50 transition duration-200 shadow-2xl text-base">
              Yuk, Daftar! <Zap size={20} className="text-amber-500" />
            </button>
            <div className="mt-4 text-xs opacity-80">✨ Cuma butuh 60 detik, tanpa ribet</div>
          </div>
        </div>
      </section>
    </div>
  );
}
