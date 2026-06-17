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
} from "lucide-react";
import { db } from "@/db";
import { getSession } from "@/lib/permissions";
import { DropFill, GallonArt } from "@/components/GallonArt";

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

  // Baca config depot untuk personalisasi
  const cfgRows = await db.query.pengaturan.findMany();
  const cfg = Object.fromEntries(cfgRows.map((r) => [r.key, r.value ?? ""]));
  const namaDepot = cfg.namaDepot || "DEPOT GNR";
  const alamat = cfg.alamatDepot || "";
  const telp = cfg.telpDepot || "";
  const heroBadge = cfg.heroBadge || "SEGAR TIAP HARI";
  const heroTitle = cfg.heroTitle || "Air minum berkualitas\nantar sampai rumah.";
  const heroSubtitle =
    cfg.heroSubtitle ||
    "Pesan galon isi ulang dari depot terdekat. Antar cepat, harga jujur, lacak realtime.";

  // Promo banner — bisa disembunyikan dengan promoAktif=0
  const promoAktif = (cfg.promoAktif ?? "1") !== "0";
  const promoBadge = cfg.promoBadge || "★ Pelanggan Baru ★";
  const promoTitle = cfg.promoTitle || "Bonus Rp 5.000 untuk Daftar Hari Ini";
  const promoSubtitle =
    cfg.promoSubtitle ||
    "Saldo loyalty otomatis masuk setelah order pertama berhasil. Plus dapat kode referral untuk ajak teman — tambah bonus lagi!";
  const promoCta = cfg.promoCta || "Klaim Bonus Saya";

  return (
    <div className="min-h-screen bg-[color:var(--surface2)]">
      {/* Top bar */}
      <header className="bg-surface border-b border-line sticky top-0 z-20 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <span className="w-10 h-10 rounded-xl bg-brand text-white grid place-items-center">
              <DropFill size={22} color="white" />
            </span>
            <div>
              <div className="font-extrabold text-base leading-tight">{namaDepot}</div>
              <div className="text-[10px] text-[color:var(--muted)] leading-tight">
                Air Isi Ulang
              </div>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 text-sm font-bold text-brand border-2 border-brand bg-surface hover:bg-brand-soft rounded-lg transition"
            >
              Masuk
            </Link>
            <Link
              href="/register"
              className="px-3 sm:px-4 py-2 bg-brand-600 text-white text-sm font-bold rounded-lg hover:bg-brand-700 transition shadow-md shadow-brand/30"
            >
              Daftar
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-30 pointer-events-none"
          style={{
            background:
              "radial-gradient(circle at 20% 50%, var(--brand-soft) 0%, transparent 50%), radial-gradient(circle at 80% 20%, var(--brand-soft) 0%, transparent 50%)",
          }}
        />
        <div className="max-w-6xl mx-auto px-4 py-12 md:py-20 relative">
          <div className="grid lg:grid-cols-2 gap-8 items-center">
            <div className="text-center lg:text-left">
              <div className="inline-flex items-center gap-1.5 bg-brand-soft text-brand text-xs font-extrabold tracking-widest uppercase px-3 py-1.5 rounded-full mb-4">
                <Sparkles size={12} /> {heroBadge}
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1] mb-4 whitespace-pre-line">
                {heroTitle}
              </h1>
              <p className="text-base md:text-lg text-[color:var(--muted)] max-w-xl mx-auto lg:mx-0 mb-6">
                {heroSubtitle}
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
                <Link
                  href="/register"
                  className="px-6 py-3 bg-brand-600 text-white font-extrabold rounded-xl hover:bg-brand-700 transition inline-flex items-center justify-center gap-2 shadow-lg shadow-brand/30"
                >
                  Mulai Sekarang <ArrowRight size={18} />
                </Link>
                <Link
                  href="/login"
                  className="px-6 py-3 border-2 border-brand text-brand font-extrabold rounded-xl hover:bg-brand-soft transition inline-flex items-center justify-center gap-2"
                >
                  Sudah Punya Akun
                </Link>
              </div>
              <p className="text-xs text-[color:var(--muted)] mt-4">
                ✓ Gratis daftar · ✓ Tanpa biaya pendaftaran · ✓ Promo Rp 5.000 untuk
                pelanggan baru
              </p>
            </div>

            <div className="relative">
              <div className="aspect-square max-w-md mx-auto bg-gradient-to-br from-brand-soft via-surface to-brand-soft rounded-3xl grid place-items-center">
                <GallonArt size={200} />
              </div>
              <div className="absolute top-4 right-4 sm:top-8 sm:right-8 bg-surface border border-line rounded-2xl shadow-lg p-3 max-w-[180px]">
                <div className="text-[10px] font-extrabold text-emerald-700 uppercase tracking-wider">
                  ✓ Sukses
                </div>
                <div className="text-xs font-bold mt-1">Pesanan diantar dalam 30 menit</div>
              </div>
              <div className="absolute bottom-4 left-4 sm:bottom-8 sm:left-8 bg-surface border border-line rounded-2xl shadow-lg p-3 max-w-[180px]">
                <div className="text-[10px] font-extrabold text-brand uppercase tracking-wider">
                  🎁 Cashback
                </div>
                <div className="text-xs font-bold mt-1">Rp 500/galon ke saldo loyalty</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits grid */}
      <section className="max-w-6xl mx-auto px-4 py-12 md:py-16">
        <div className="text-center mb-8">
          <div className="text-xs font-extrabold tracking-widest text-brand uppercase mb-2">
            Kenapa pakai sistem kami?
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold">Semua jadi lebih mudah</h2>
          <p className="text-sm text-[color:var(--muted)] mt-2">
            Tidak perlu antri, tidak perlu telpon, tidak perlu hafal nomor.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Benefit
            icon={<Truck size={22} />}
            title="Antar Sampai Rumah"
            desc="Order dari HP, kurir langsung datang. Cocok untuk yang sibuk atau ibu rumah tangga yang tidak bisa antar galon kosong sendiri."
          />
          <Benefit
            icon={<MapPin size={22} />}
            title="Lacak Kurir Realtime"
            desc="Tahu posisi kurir di peta — bisa lihat live kurir mendekat. Siap-siap terima air."
          />
          <Benefit
            icon={<Gift size={22} />}
            title="Cashback Setiap Order"
            desc="Tiap galon dapat saldo loyalty Rp 250-500. Bisa potong harga order berikutnya."
          />
          <Benefit
            icon={<CreditCard size={22} />}
            title="Bayar Fleksibel"
            desc="Cash COD, transfer bank, QRIS, atau DANA. Pilih sesuai keinginan Anda."
          />
          <Benefit
            icon={<MessageCircle size={22} />}
            title="Notif WhatsApp"
            desc="Update status order langsung ke WA. Dari pesan dibuat sampai sampai di rumah, Anda tahu semuanya."
          />
          <Benefit
            icon={<FileText size={22} />}
            title="Riwayat & Cetak Nota"
            desc="Semua order tersimpan rapi. Bisa cetak nota untuk arsip kantor / klaim reimbursement."
          />
        </div>
      </section>

      {/* How it works */}
      <section className="bg-surface border-y border-line">
        <div className="max-w-6xl mx-auto px-4 py-12 md:py-16">
          <div className="text-center mb-10">
            <div className="text-xs font-extrabold tracking-widest text-brand uppercase mb-2">
              3 langkah mulai
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold">
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
              desc="Pilih jumlah galon, tipe transaksi (isi ulang / tukar / beli baru), metode bayar. Klik kirim."
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
              className="inline-flex items-center gap-2 px-6 py-3 bg-brand-600 text-white font-extrabold rounded-xl hover:bg-brand-700 transition shadow-lg shadow-brand/30"
            >
              Daftar Gratis Sekarang <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* Promo banner */}
      {promoAktif && (
        <section className="max-w-6xl mx-auto px-4 py-12 md:py-16">
          <div className="rounded-3xl bg-gradient-to-br from-[color:var(--accent)] via-[color:var(--accent)] to-amber-600 p-8 md:p-12 text-center text-white relative overflow-hidden">
            <div className="absolute inset-0 opacity-20 pointer-events-none">
              <div className="absolute top-4 right-4 w-32 h-32 rounded-full bg-white blur-3xl" />
              <div className="absolute bottom-4 left-4 w-32 h-32 rounded-full bg-white blur-3xl" />
            </div>
            <div className="relative">
              <div className="inline-block bg-white/20 backdrop-blur text-[11px] font-extrabold tracking-widest uppercase px-3 py-1.5 rounded-full mb-3">
                {promoBadge}
              </div>
              <h2 className="text-3xl md:text-4xl font-extrabold mb-3 whitespace-pre-line">
                {promoTitle}
              </h2>
              <p className="text-sm md:text-base opacity-95 max-w-xl mx-auto mb-6 whitespace-pre-line">
                {promoSubtitle}
              </p>
              <Link
                href="/register"
                className="inline-flex items-center gap-2 px-6 py-3 bg-white text-amber-700 font-extrabold rounded-xl hover:bg-amber-50 transition"
              >
                {promoCta} <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Contact / Footer */}
      <footer className="bg-surface border-t border-line">
        <div className="max-w-6xl mx-auto px-4 py-10">
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <div>
              <div className="inline-flex items-center gap-2 mb-3">
                <span className="w-9 h-9 rounded-xl bg-brand text-white grid place-items-center">
                  <DropFill size={18} color="white" />
                </span>
                <div className="font-extrabold">{namaDepot}</div>
              </div>
              <p className="text-xs text-[color:var(--muted)] leading-relaxed">
                Air minum isi ulang berkualitas. Antar cepat, harga jujur, sehat
                untuk keluarga.
              </p>
            </div>
            <div>
              <div className="text-xs font-extrabold tracking-widest text-[color:var(--muted)] uppercase mb-3">
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
                  <div className="inline-flex items-start gap-2 text-[color:var(--muted)] text-xs">
                    <MapPin size={14} className="flex-shrink-0 mt-0.5" />
                    {alamat}
                  </div>
                )}
                <div className="inline-flex items-center gap-2 text-[color:var(--muted)] text-xs">
                  <Clock size={14} /> Senin–Sabtu, 07:00–17:00
                </div>
              </div>
            </div>
            <div>
              <div className="text-xs font-extrabold tracking-widest text-[color:var(--muted)] uppercase mb-3">
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
          <div className="pt-6 border-t border-line text-center text-[11px] text-[color:var(--muted)]">
            © 2026 {namaDepot} · Dibuat dengan cinta untuk pelanggan setia 💧
          </div>
        </div>
      </footer>
    </div>
  );
}

function Benefit({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="bg-surface border border-line rounded-2xl p-5 hover:border-brand transition group">
      <div className="w-11 h-11 rounded-xl bg-brand-soft text-brand grid place-items-center group-hover:bg-brand group-hover:text-white transition">
        {icon}
      </div>
      <h3 className="font-extrabold text-base mt-3">{title}</h3>
      <p className="text-xs text-[color:var(--muted)] mt-1.5 leading-relaxed">{desc}</p>
    </div>
  );
}

function Step({ num, title, desc }: { num: string; title: string; desc: string }) {
  return (
    <div className="text-center md:text-left relative">
      <div className="inline-flex items-center justify-center w-12 h-12 bg-brand text-white font-extrabold text-xl rounded-2xl mb-3">
        {num}
      </div>
      <h3 className="font-extrabold text-lg mb-1">{title}</h3>
      <p className="text-sm text-[color:var(--muted)]">{desc}</p>
    </div>
  );
}
