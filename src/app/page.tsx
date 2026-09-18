import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Truck,
  MapPin,
  Gift,
  CreditCard,
  MessageCircle,
  FileText,
  ArrowRight,
  Sparkles,
  Phone,
  Clock,
  Star,
  Check,
} from "lucide-react";
import { sql, eq } from "drizzle-orm";
import { db } from "@/db";
import { pelanggan } from "@/db/schema/pelanggan";
import { orderItem } from "@/db/schema/order";
import { orderHeader } from "@/db/schema/order";
import { getSession } from "@/lib/permissions";
import { DropFill, GallonArt } from "@/components/GallonArt";
import { NumberTicker } from "@/components/NumberTicker";
import { BorderBeam } from "@/components/magic-ui/BorderBeam";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getSession();
  if (session) {
    const role = session.user.role ?? "pelanggan";
    if (role === "admin") redirect("/admin/dashboard");
    if (role === "kasir") redirect("/kasir/pos");
    if (role === "kurir") redirect("/kurir");
    redirect("/pelanggan/beranda");
  }

  // Baca config depot untuk personalisasi (via /admin/pengaturan)
  const cfgRows = await db.query.pengaturan.findMany();
  const cfg = Object.fromEntries(cfgRows.map((r) => [r.key, r.value ?? ""]));
  const namaDepot = cfg.namaDepot || "DEPOT GNR";
  const alamat = cfg.alamatDepot || "";
  const telp = cfg.telpDepot || "";
  const heroBadge = cfg.heroBadge || "TERPERCAYA SEJAK 2020";
  const heroTitle =
    cfg.heroTitle ||
    "Air minum berkualitas,\nantar dalam 30 menit.";
  const heroSubtitle =
    cfg.heroSubtitle ||
    "Pesan galon isi ulang dari depot terdekat. Sudah dipercaya ribuan keluarga di Kota Gorontalo. Antar cepat, harga jujur, lacak realtime.";

  // Promo banner
  const promoAktif = (cfg.promoAktif ?? "1") !== "0";
  const promoBadge = cfg.promoBadge || "★ Pelanggan Baru ★";
  const promoTitle = cfg.promoTitle || "Bonus Rp 5.000 untuk Daftar Hari Ini";
  const promoSubtitle =
    cfg.promoSubtitle ||
    "Saldo loyalty otomatis masuk setelah order pertama berhasil. Plus dapat kode referral untuk ajak teman.";
  const promoCta = cfg.promoCta || "Klaim Bonus Saya";

  // Stat real dari DB. Boleh 0 kalau depot baru — Number Ticker tetap animate.
  const [pelCount, galonSum] = await Promise.all([
    db.select({ n: sql<number>`count(*)` }).from(pelanggan),
    db
      .select({ n: sql<number>`coalesce(sum(${orderItem.qty}), 0)` })
      .from(orderItem)
      .innerJoin(orderHeader, eq(orderItem.orderId, orderHeader.id))
      .where(eq(orderHeader.status, "selesai")),
  ]);
  const totalPelanggan = Number(pelCount[0]?.n ?? 0);
  const totalGalon = Number(galonSum[0]?.n ?? 0);
  // Rating placeholder (kalau punya rating system nanti, ambil dari DB)
  const rating = Number(cfg.landingRating || "4.9");
  const rataAntarMenit = Number(cfg.landingAntarMenit || "30");

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Header */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-30 backdrop-blur-lg bg-white/80">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <span className="w-10 h-10 rounded-xl bg-brand text-white grid place-items-center">
              <DropFill size={22} color="white" />
            </span>
            <div>
              <div className="font-extrabold text-base leading-tight">{namaDepot}</div>
              <div className="text-[10px] text-slate-500 leading-tight">Air Isi Ulang</div>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="px-3 sm:px-4 py-2 text-sm font-bold text-brand hover:bg-brand-soft rounded-lg transition"
            >
              Masuk
            </Link>
            <Link
              href="/register"
              className="px-3 sm:px-4 py-2 bg-brand text-white text-sm font-bold rounded-lg hover:bg-brand-deep transition shadow-sm"
            >
              Daftar
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-white via-brand-soft/30 to-white">
        <div className="max-w-6xl mx-auto px-4 py-14 md:py-24">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <div className="text-center lg:text-left">
              <div className="inline-flex items-center gap-1.5 bg-white border border-brand/20 text-brand text-xs font-extrabold tracking-widest uppercase px-3 py-1.5 rounded-full mb-5 shadow-sm">
                <Sparkles size={12} /> {heroBadge}
              </div>
              <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-[1.05] mb-5 text-slate-900 whitespace-pre-line">
                {heroTitle}
              </h1>
              <p className="text-base md:text-lg text-slate-600 max-w-xl mx-auto lg:mx-0 mb-7 leading-relaxed">
                {heroSubtitle}
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
                <div className="relative rounded-xl overflow-hidden">
                  <Link
                    href="/register"
                    className="relative w-full px-6 py-3.5 bg-brand text-white font-extrabold rounded-xl hover:bg-brand-deep transition inline-flex items-center justify-center gap-2 shadow-lg shadow-brand/30"
                  >
                    Mulai Sekarang <ArrowRight size={18} />
                  </Link>
                  <BorderBeam size={80} duration={12} colorFrom="#a5f3fc" colorTo="#0284c7" />
                </div>
                <Link
                  href="/login"
                  className="px-6 py-3.5 bg-white text-slate-900 font-extrabold rounded-xl hover:bg-slate-50 transition inline-flex items-center justify-center gap-2 shadow-sm border border-slate-200"
                >
                  Sudah Punya Akun
                </Link>
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-4 text-xs text-slate-500 justify-center lg:justify-start">
                <div className="inline-flex items-center gap-1">
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star
                        key={i}
                        size={14}
                        className="fill-amber-400 text-amber-400"
                      />
                    ))}
                  </div>
                  <span className="font-bold text-slate-700">{rating}/5</span>
                </div>
                <span className="inline-flex items-center gap-1">
                  <Check size={14} className="text-emerald-600" /> COD tersedia
                </span>
                <span className="inline-flex items-center gap-1">
                  <Check size={14} className="text-emerald-600" /> Cashback Rp 500/galon
                </span>
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
                <div className="text-xs font-bold mt-1">
                  Pesanan diantar &lt;{rataAntarMenit} menit
                </div>
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

      {/* Stat bar — real data dari DB */}
      <section className="border-y border-slate-100 bg-slate-50/50">
        <div className="max-w-5xl mx-auto px-4 py-8 grid grid-cols-2 md:grid-cols-4 gap-5 text-center">
          <div>
            <div className="text-2xl md:text-3xl font-extrabold text-brand">
              <NumberTicker value={totalPelanggan} suffix="+" />
            </div>
            <div className="text-xs text-slate-500 mt-1">Pelanggan aktif</div>
          </div>
          <div>
            <div className="text-2xl md:text-3xl font-extrabold text-brand">
              <NumberTicker value={totalGalon} suffix="+" />
            </div>
            <div className="text-xs text-slate-500 mt-1">Galon terkirim</div>
          </div>
          <div>
            <div className="text-2xl md:text-3xl font-extrabold text-brand">
              <NumberTicker value={rataAntarMenit} suffix=" menit" />
            </div>
            <div className="text-xs text-slate-500 mt-1">Rata-rata antar</div>
          </div>
          <div>
            <div className="text-2xl md:text-3xl font-extrabold text-brand">
              <NumberTicker value={rating} decimalPlaces={1} suffix="/5" />
            </div>
            <div className="text-xs text-slate-500 mt-1">Rating pelanggan</div>
          </div>
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
            {
              icon: Truck,
              title: "Antar Sampai Rumah",
              desc: "Order dari HP, kurir langsung datang. Cocok untuk yang sibuk atau ibu rumah tangga.",
            },
            {
              icon: MapPin,
              title: "Lacak Kurir Realtime",
              desc: "Tahu posisi kurir di peta — lihat kurir mendekat. Siap-siap terima air.",
            },
            {
              icon: Gift,
              title: "Cashback Setiap Order",
              desc: "Rp 500/galon otomatis masuk saldo loyalty. Bisa potong harga order berikutnya.",
            },
            {
              icon: CreditCard,
              title: "Bayar Fleksibel",
              desc: "Cash COD, transfer bank, QRIS, atau DANA. Pilih sesuai keinginan.",
            },
            {
              icon: MessageCircle,
              title: "Notif WhatsApp",
              desc: "Update status order langsung ke WA. Dari pesan dibuat sampai sampai di rumah.",
            },
            {
              icon: FileText,
              title: "Riwayat & Cetak Nota",
              desc: "Semua order tersimpan rapi. Bisa cetak nota untuk arsip atau reimbursement.",
            },
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

      {/* How it works */}
      <section className="bg-slate-50/70 border-y border-slate-100">
        <div className="max-w-6xl mx-auto px-4 py-16 md:py-20">
          <div className="text-center mb-12">
            <div className="text-xs font-extrabold tracking-widest text-brand uppercase mb-2">
              3 langkah mulai
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">
              Gampang, kurang dari 5 menit
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6 md:gap-4">
            <Step
              num="1"
              title="Daftar Akun"
              desc="Klik Daftar di pojok kanan atas. Isi nama, email, nomor WhatsApp, alamat. Selesai."
            />
            <Step
              num="2"
              title="Pesan Air"
              desc="Pilih jumlah galon, tipe transaksi (isi ulang / tukar / beli baru), metode bayar."
            />
            <Step
              num="3"
              title="Terima di Rumah"
              desc="Tunggu kurir datang. Bayar (kalau COD) atau upload bukti transfer. Air siap diminum!"
            />
          </div>

          <div className="text-center mt-10">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 px-6 py-3 bg-brand text-white font-extrabold rounded-xl hover:bg-brand-deep transition shadow-lg shadow-brand/30"
            >
              Daftar Gratis Sekarang <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* Promo CTA */}
      {promoAktif && (
        <section className="max-w-6xl mx-auto px-4 py-16">
          <div className="rounded-3xl bg-gradient-to-br from-brand via-brand to-brand-deep p-10 md:p-16 text-center text-white relative overflow-hidden">
            <div className="absolute inset-0 opacity-20 pointer-events-none">
              <div className="absolute top-4 right-4 w-40 h-40 rounded-full bg-white blur-3xl" />
              <div className="absolute bottom-4 left-4 w-40 h-40 rounded-full bg-white blur-3xl" />
            </div>
            <div className="relative max-w-2xl mx-auto">
              <div className="inline-block bg-white/20 backdrop-blur text-[11px] font-extrabold tracking-widest uppercase px-3 py-1.5 rounded-full mb-4">
                {promoBadge}
              </div>
              <h2 className="text-3xl md:text-5xl font-extrabold mb-4 leading-tight whitespace-pre-line">
                {promoTitle}
              </h2>
              <p className="text-base md:text-lg opacity-95 mb-8 whitespace-pre-line">
                {promoSubtitle}
              </p>
              <Link
                href="/register"
                className="inline-flex items-center gap-2 px-8 py-4 bg-white text-brand-deep font-extrabold rounded-xl hover:bg-slate-50 transition shadow-lg text-base"
              >
                {promoCta} <ArrowRight size={20} />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Contact / Footer */}
      <footer className="bg-slate-50 border-t border-slate-100">
        <div className="max-w-6xl mx-auto px-4 py-10">
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <div>
              <div className="inline-flex items-center gap-2 mb-3">
                <span className="w-9 h-9 rounded-xl bg-brand text-white grid place-items-center">
                  <DropFill size={18} color="white" />
                </span>
                <div className="font-extrabold">{namaDepot}</div>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Air minum isi ulang berkualitas. Antar cepat, harga jujur, sehat untuk keluarga.
              </p>
            </div>
            <div>
              <div className="text-xs font-extrabold tracking-widest text-slate-500 uppercase mb-3">
                Hubungi Kami
              </div>
              <div className="space-y-2 text-sm">
                {telp && (
                  <a
                    href={`https://wa.me/62${telp.replace(/^0/, "")}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 hover:text-brand transition"
                  >
                    <Phone size={14} /> {telp}
                  </a>
                )}
                {alamat && (
                  <div className="inline-flex items-start gap-2 text-slate-500 text-xs">
                    <MapPin size={14} className="flex-shrink-0 mt-0.5" />
                    {alamat}
                  </div>
                )}
                <div className="inline-flex items-center gap-2 text-slate-500 text-xs">
                  <Clock size={14} /> Senin–Sabtu, 07:00–17:00
                </div>
              </div>
            </div>
            <div>
              <div className="text-xs font-extrabold tracking-widest text-slate-500 uppercase mb-3">
                Aplikasi
              </div>
              <div className="flex flex-col gap-2 text-sm">
                <Link href="/login" className="hover:text-brand transition">
                  Masuk Akun
                </Link>
                <Link href="/register" className="hover:text-brand transition">
                  Daftar Baru
                </Link>
                <Link href="/lupa-password" className="hover:text-brand transition">
                  Lupa Password
                </Link>
              </div>
            </div>
          </div>
          <div className="pt-6 border-t border-slate-200 text-center text-[11px] text-slate-500">
            © 2026 {namaDepot} · Dibuat dengan cinta untuk pelanggan setia 💧
          </div>
        </div>
      </footer>
    </div>
  );
}

function Step({
  num,
  title,
  desc,
}: {
  num: string;
  title: string;
  desc: string;
}) {
  return (
    <div className="text-center md:text-left relative bg-white rounded-2xl p-6 border border-slate-100 hover:border-brand hover:shadow-lg hover:shadow-brand/5 transition">
      <div className="inline-flex items-center justify-center w-12 h-12 bg-brand text-white font-extrabold text-xl rounded-2xl mb-3">
        {num}
      </div>
      <h3 className="font-extrabold text-lg mb-1">{title}</h3>
      <p className="text-sm text-slate-600">{desc}</p>
    </div>
  );
}
