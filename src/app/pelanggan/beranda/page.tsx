import Link from "next/link";
import { eq, and, desc, ne } from "drizzle-orm";
import { Plus, Truck, History, Bell, ArrowRight, MapPin } from "lucide-react";
import { db } from "@/db";
import { orderHeader } from "@/db/schema/order";
import { produk } from "@/db/schema/produk";
import { pengaturan } from "@/db/schema/pengaturan";
import { requireSession } from "@/lib/permissions";
import { getOrCreatePelanggan } from "@/lib/pelanggan";
import { formatRupiah } from "@/lib/utils";
import { CancelOrderButton } from "../order-baru/CancelOrderButton";
import { NotifSubscribe } from "@/components/NotifSubscribe";
import { GallonArt, DropFill } from "@/components/GallonArt";
import { getSaldoGalonPinjam } from "@/lib/galon-pinjam";

export const dynamic = "force-dynamic";

export default async function BerandaPage() {
  const session = await requireSession();
  const me = await getOrCreatePelanggan(session.user.id, session.user.name);

  const aktif = await db
    .select()
    .from(orderHeader)
    .where(and(eq(orderHeader.pelangganId, me.id), ne(orderHeader.status, "selesai")))
    .orderBy(desc(orderHeader.createdAt))
    .limit(3);

  const produkAktif = await db.query.produk.findMany({
    where: eq(produk.aktif, true),
    orderBy: (p, { asc }) => [asc(p.id)],
    limit: 6,
  });

  // Baca pengaturan untuk hero copy + reward card dinamis
  const cfgRows = await db.query.pengaturan.findMany();
  const cfg = Object.fromEntries(cfgRows.map((r) => [r.key, r.value ?? ""]));
  const hero = {
    badge: cfg.heroBadge?.trim() || "SEGAR TIAP HARI",
    title: cfg.heroTitle?.trim() || "Stok air keluarga aman dalam 30 menit.",
    subtitle:
      cfg.heroSubtitle?.trim() ||
      "Pesan galon isi ulang dari depot terdekat. Antar cepat, harga jujur.",
    cta: cfg.heroCta?.trim() || "Pesan sekarang",
  };

  // Reward card dinamis berdasarkan pengaturan loyalty
  const stampAktif = (cfg.aktifkanStampGalon ?? "1") !== "0";
  const stampThreshold = Math.max(1, Number(cfg.stampThresholdGalon) || 10);
  const stampNilai = Math.max(0, Number(cfg.nilaiGalonGratis) || 5_000);
  const rateAntar = Math.max(0, Number(cfg.loyaltiPerGalonAntar) || 250);
  const rateDepot = Math.max(0, Number(cfg.loyaltiPerGalonDepot) || 500);

  const reward = (() => {
    if (stampAktif && stampNilai > 0) {
      return {
        badge: "REWARD LOYALTY",
        title: `Setiap ${stampThreshold} galon, dapat\nRp ${stampNilai.toLocaleString("id-ID")} saldo!`,
      };
    }
    if (rateAntar > 0 || rateDepot > 0) {
      const max = Math.max(rateAntar, rateDepot);
      return {
        badge: "CASHBACK GALON",
        title: `Tiap galon dapat\nhingga Rp ${max.toLocaleString("id-ID")} saldo`,
      };
    }
    return null; // Hide card kalau tidak ada program reward
  })();

  const totalOrders = await db
    .select()
    .from(orderHeader)
    .where(and(eq(orderHeader.pelangganId, me.id), ne(orderHeader.status, "batal")));
  const totalGalon = me.stampGalon;

  // Saldo galon depot yang sedang dipegang pelanggan (untuk reminder kembalikan)
  const galonPinjam = await getSaldoGalonPinjam(me.id);

  return (
    <div className="max-w-3xl mx-auto pb-4">
      {/* Header bar */}
      <header className="px-4 pt-4 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-brand text-white grid place-items-center font-bold">
            {me.nama.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="text-[11px] text-[color:var(--muted)]">Halo, selamat datang</div>
            <div className="text-[15px] font-extrabold text-ink leading-tight">{me.nama} 👋</div>
          </div>
        </div>
        <Link
          href="/pelanggan/loyalty"
          className="w-10 h-10 rounded-full bg-[color:var(--surface2)] grid place-items-center text-ink relative"
        >
          <Bell size={18} />
          {aktif.length > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[color:var(--accent2)] rounded-full" />
          )}
        </Link>
      </header>

      <div className="px-4">
        <NotifSubscribe />
      </div>

      {/* Bold Hero card */}
      <div className="px-4 mt-4">
        <div className="relative overflow-hidden rounded-3xl p-6 text-white min-h-[280px]"
          style={{
            background: "var(--brand)",
          }}
        >
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 80% 20%, var(--brand-deep) 0%, transparent 60%)",
            }}
          />
          <div className="relative">
            <div className="text-[11px] font-bold tracking-widest opacity-85">
              {hero.badge}
            </div>
            <h2 className="text-[28px] font-extrabold leading-[1.1] tracking-tight mt-2 whitespace-pre-line">
              {hero.title}
            </h2>
            <p className="text-[13px] opacity-85 mt-2 max-w-[280px]">
              {hero.subtitle}
            </p>
          </div>
          <div
            className="absolute -right-4 -bottom-2 opacity-95"
            style={{ transform: "rotate(8deg)", filter: "drop-shadow(0 10px 20px rgba(0,0,0,0.25))" }}
          >
            <GallonArt size={130} color="white" accent="var(--brand-deep)" />
          </div>
          <Link
            href="/pelanggan/order-baru"
            className="absolute left-6 bottom-6 inline-flex items-center gap-2 h-12 px-5 rounded-full bg-white text-[color:var(--brand-deep)] font-extrabold text-sm"
          >
            {hero.cta} <ArrowRight size={16} />
          </Link>
        </div>
      </div>

      {/* Stats row */}
      <div className="px-4 mt-4 grid grid-cols-3 gap-2">
        <StatCard label="Total\nGalon" value={String(totalGalon)} />
        <StatCard
          label="Saldo\nLoyalty"
          value={formatRupiah(me.saldoLoyalti).replace("Rp ", "")}
          accent="brand"
        />
        <StatCard label="Total\nOrder" value={String(totalOrders.length)} accent="alt" />
      </div>

      {/* Progress menuju reward stempel berikutnya */}
      {stampAktif && (() => {
        const stampNow = me.stampGalon % stampThreshold;
        const pct = Math.round((stampNow / stampThreshold) * 100);
        const sisa = stampThreshold - stampNow;
        return (
          <Link
            href="/pelanggan/loyalty"
            className="block px-4 mt-3"
          >
            <div className="bg-surface border border-line rounded-2xl p-3">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <div className="font-bold inline-flex items-center gap-1">
                  💧 Progress reward galon gratis
                </div>
                <div className="text-[color:var(--muted)]">
                  {stampNow}/{stampThreshold}
                </div>
              </div>
              <div className="h-2.5 bg-[color:var(--surface2)] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${pct}%`,
                    background:
                      pct >= 80
                        ? "linear-gradient(90deg, #f59e0b, #f97316)"
                        : "var(--brand)",
                  }}
                />
              </div>
              <div className="text-[10px] text-[color:var(--muted)] mt-1.5 flex items-center justify-between">
                <span>
                  {sisa === 0
                    ? "🎉 Reward siap diklaim di order berikutnya!"
                    : `Sisa ${sisa} galon lagi → +${formatRupiah(stampNilai)}`}
                </span>
                <span className="text-brand font-bold">Lihat →</span>
              </div>
            </div>
          </Link>
        );
      })()}

      {/* Status galon depot dipinjam — reminder kembalikan */}
      {galonPinjam.total > 0 && (() => {
        const detail = galonPinjam.perProduk
          .filter((p) => p.jumlah > 0)
          .map((p) => `${p.jumlah}× ${p.namaProduk ?? "Galon"}`)
          .join(" · ");
        const titleTpl =
          cfg.galonPinjamTitle?.trim() || "Kamu sedang pinjam {jumlah} galon depot";
        const subtitleTpl =
          cfg.galonPinjamSubtitle?.trim() ||
          "{detail}. Mohon dikembalikan saat order berikutnya 🙏";
        const title = titleTpl.replaceAll("{jumlah}", String(galonPinjam.total));
        const subtitle = subtitleTpl
          .replaceAll("{detail}", detail)
          .replaceAll("{jumlah}", String(galonPinjam.total));
        return (
          <div className="px-4 mt-4">
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-amber-100 grid place-items-center flex-shrink-0">
                <Truck size={16} className="text-amber-700" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-amber-900 text-xs">{title}</div>
                <div className="text-[11px] text-amber-800 mt-0.5 leading-snug whitespace-pre-line">
                  {subtitle}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Warning lokasi belum diset */}
      {(me.koordinatLat === null || me.koordinatLng === null) && (
        <div className="px-4 mt-4">
          <Link
            href="/akun"
            className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-3 hover:bg-amber-100 transition"
          >
            <div className="w-9 h-9 rounded-full bg-amber-100 grid place-items-center flex-shrink-0">
              <MapPin size={16} className="text-amber-700" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-amber-900 text-xs">
                Tandai lokasi rumah di peta
              </div>
              <div className="text-[11px] text-amber-800 mt-0.5">
                Supaya kurir antar tepat sasaran →
              </div>
            </div>
          </Link>
        </div>
      )}

      {/* Order aktif */}
      {aktif.length > 0 && (
        <section className="px-4 mt-5">
          <div className="flex items-end justify-between mb-2">
            <h3 className="font-extrabold text-base inline-flex items-center gap-1.5">
              <Truck size={16} className="text-brand" /> Pesanan berjalan
            </h3>
            <Link href="/pelanggan/riwayat" className="text-xs text-brand font-semibold">
              Semua
            </Link>
          </div>
          <div className="space-y-2">
            {aktif.map((o) => (
              <div
                key={o.id}
                className="bg-surface border border-line rounded-2xl p-3 flex justify-between items-center gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-12 rounded-lg bg-brand-soft grid place-items-center flex-shrink-0">
                    <DropFill size={18} color="var(--brand)" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-mono text-[color:var(--muted)]">
                      {o.nomorOrder}
                    </div>
                    <div className="text-sm font-semibold capitalize">{o.status}</div>
                    <div className="text-[10px] text-[color:var(--muted)]">
                      {o.createdAt.toLocaleString("id-ID", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </div>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-extrabold text-brand">
                    {formatRupiah(o.totalEstimasi)}
                  </div>
                  {o.status === "pending" && (
                    <div className="mt-1">
                      <CancelOrderButton orderId={o.id} nomorOrder={o.nomorOrder} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Produk */}
      <section className="px-4 mt-5">
        <div className="flex items-end justify-between mb-2">
          <h3 className="font-extrabold text-base">Pilih air kamu</h3>
          <Link
            href="/pelanggan/order-baru"
            className="text-xs text-brand font-semibold inline-flex items-center gap-0.5"
          >
            Semua <ArrowRight size={11} />
          </Link>
        </div>
        <div className="space-y-2">
          {produkAktif.slice(0, 4).map((p, i) => {
            const tier = i % 3 === 0 ? "standard" : i % 3 === 1 ? "premium" : "ro";
            const lowestPrice = Math.min(
              ...[p.hargaIsiUlang, p.hargaTukar, p.hargaBeliBaru].filter((x) => x > 0),
            );
            return (
              <Link
                key={p.id}
                href={`/pelanggan/order-baru`}
                className="bg-surface border border-line rounded-2xl p-3 flex items-center gap-3 hover:border-brand transition"
              >
                <div className="w-16 h-20 rounded-xl bg-[color:var(--surface2)] grid place-items-center flex-shrink-0">
                  <GallonArt size={50} tier={tier as "standard" | "premium" | "ro"} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm">{p.nama}</div>
                  {p.deskripsi && (
                    <div className="text-xs text-[color:var(--muted)] line-clamp-1">
                      {p.deskripsi}
                    </div>
                  )}
                  <div className="text-base font-extrabold text-brand mt-1">
                    Mulai {formatRupiah(lowestPrice)}
                  </div>
                </div>
                <button className="w-9 h-9 rounded-xl bg-brand text-white grid place-items-center flex-shrink-0">
                  <Plus size={20} strokeWidth={2.5} />
                </button>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Promo / Auto-refill */}
      {reward && (
        <section className="px-4 mt-5 mb-4">
          <Link
            href="/pelanggan/loyalty"
            className="block rounded-2xl p-5 text-ink relative overflow-hidden"
            style={{
              background: "linear-gradient(135deg, var(--accent), var(--accent))",
            }}
          >
            <div className="text-[11px] font-bold tracking-widest opacity-80">
              {reward.badge}
            </div>
            <div className="text-lg font-extrabold mt-1 leading-tight whitespace-pre-line">
              {reward.title}
            </div>
            <div className="mt-3 inline-flex items-center gap-1 px-3 py-1.5 bg-ink text-white rounded-full text-[11px] font-bold">
              Lihat saldo →
            </div>
            <div className="absolute right-2 -bottom-2 opacity-50">
              <GallonArt size={90} tier="standard" />
            </div>
          </Link>
        </section>
      )}

      <Link
        href="/pelanggan/riwayat"
        className="flex items-center justify-center gap-1.5 py-3 text-sm text-[color:var(--muted)] hover:text-brand"
      >
        <History size={14} /> Riwayat lengkap
      </Link>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "brand" | "alt";
}) {
  const color =
    accent === "brand" ? "text-brand" : accent === "alt" ? "text-[color:var(--accent2)]" : "text-ink";
  return (
    <div className="bg-[color:var(--surface2)] rounded-2xl p-3">
      <div className={`text-xl font-extrabold leading-tight ${color}`}>{value}</div>
      <div className="text-[10px] text-[color:var(--muted)] mt-1 whitespace-pre-line font-semibold leading-tight">
        {label}
      </div>
    </div>
  );
}
