import Link from "next/link";
import { and, eq, gte, isNull, sql, inArray, desc } from "drizzle-orm";
import {
  ShoppingCart,
  Truck,
  Receipt,
  Wallet,
  Coins,
  Droplets,
  ArrowRight,
} from "lucide-react";
import { db } from "@/db";
import { transaksi, transaksiItem } from "@/db/schema/transaksi";
import { orderHeader } from "@/db/schema/order";
import { pelanggan as pelangganTable } from "@/db/schema/pelanggan";
import { requireRole } from "@/lib/permissions";
import { formatRupiah } from "@/lib/utils";
import { PageHeader } from "@/components/AppShell";
import { ShareRegistrationButton } from "@/components/ShareRegistrationButton";
import { ensureKodeReferralStaff, getStatReferralStaff } from "@/lib/referral-staff";

export const dynamic = "force-dynamic";

export default async function KasirDashboardPage() {
  const session = await requireRole(["admin", "kasir"]);
  const userId = session.user.id;

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  // 1) Transaksi POS oleh saya hari ini
  const [trxSummary] = await db
    .select({
      jml: sql<number>`count(*)`,
      omzet: sql<number>`coalesce(sum(${transaksi.total}), 0)`,
    })
    .from(transaksi)
    .where(
      and(
        eq(transaksi.kasirUserId, userId),
        gte(transaksi.createdAt, startOfDay),
        isNull(transaksi.voidedAt),
      ),
    );

  // 2) Galon hari ini (sum qty dari transaksiItem yang transaksinya saya buat)
  const trxIdsToday = await db
    .select({ id: transaksi.id })
    .from(transaksi)
    .where(
      and(
        eq(transaksi.kasirUserId, userId),
        gte(transaksi.createdAt, startOfDay),
        isNull(transaksi.voidedAt),
      ),
    );
  const idList = trxIdsToday.map((t) => t.id);
  let galonToday = 0;
  if (idList.length) {
    const [g] = await db
      .select({ qty: sql<number>`coalesce(sum(${transaksiItem.qty}), 0)` })
      .from(transaksiItem)
      .where(inArray(transaksiItem.transaksiId, idList));
    galonToday = g?.qty ?? 0;
  }

  // 3) Piutang yang saya tangani (kurirUserId=me dari POS antar/walk-in, statusBayar=belum)
  const piutangList = await db
    .select({
      id: orderHeader.id,
      nomorOrder: orderHeader.nomorOrder,
      totalEstimasi: orderHeader.totalEstimasi,
      createdAt: orderHeader.createdAt,
      pelangganNama: pelangganTable.nama,
      pelangganTelp: pelangganTable.telp,
    })
    .from(orderHeader)
    .leftJoin(pelangganTable, eq(orderHeader.pelangganId, pelangganTable.id))
    .where(
      and(
        eq(orderHeader.kurirUserId, userId),
        eq(orderHeader.statusBayar, "belum"),
      ),
    )
    .orderBy(desc(orderHeader.createdAt))
    .limit(10);
  const piutangTotal = piutangList.reduce((s, r) => s + r.totalEstimasi, 0);

  // 4b) Kode referral staff + stat untuk widget share
  const kodeReferralStaff = await ensureKodeReferralStaff(userId).catch(() => null);
  const statReferral = await getStatReferralStaff(userId).catch(() => ({
    totalAjak: 0,
    totalAktif: 0,
    bonusPending: 0,
    bonusDibayar: 0,
  }));

  // 4) Aktivitas terbaru saya — transaksi POS terakhir
  const aktivitasTerbaru = await db
    .select({
      id: transaksi.id,
      nomorNota: transaksi.nomorNota,
      createdAt: transaksi.createdAt,
      total: transaksi.total,
      metodeBayar: transaksi.metodeBayar,
      pelangganNama: pelangganTable.nama,
    })
    .from(transaksi)
    .leftJoin(pelangganTable, eq(transaksi.pelangganId, pelangganTable.id))
    .where(and(eq(transaksi.kasirUserId, userId), isNull(transaksi.voidedAt)))
    .orderBy(desc(transaksi.createdAt))
    .limit(5);

  const jamSekarang = new Date().getHours();
  const sapaan =
    jamSekarang < 11
      ? "Selamat pagi"
      : jamSekarang < 15
        ? "Selamat siang"
        : jamSekarang < 18
          ? "Selamat sore"
          : "Selamat malam";

  return (
    <div className="p-4 md:p-6 max-w-5xl space-y-5">
      <PageHeader
        title={`${sapaan}, ${session.user.name} 👋`}
        description={`Ringkasan shift kamu hari ini · ${startOfDay.toLocaleDateString("id-ID", {
          weekday: "long",
          day: "2-digit",
          month: "long",
          year: "numeric",
        })}`}
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Transaksi POS"
          value={String(trxSummary.jml ?? 0)}
          icon={<Receipt size={18} />}
          color="bg-brand-soft text-brand"
        />
        <StatCard
          label="Omzet Hari Ini"
          value={formatRupiah(trxSummary.omzet ?? 0)}
          icon={<Coins size={18} />}
          color="bg-emerald-50 text-emerald-700"
        />
        <StatCard
          label="Galon"
          value={String(galonToday)}
          icon={<Droplets size={18} />}
          color="bg-blue-50 text-blue-700"
        />
        <StatCard
          label="Piutang Saya"
          value={formatRupiah(piutangTotal)}
          subValue={`${piutangList.length} order`}
          icon={<Wallet size={18} />}
          color={piutangList.length > 0 ? "bg-amber-50 text-amber-800" : "bg-[color:var(--surface2)] text-[color:var(--muted)]"}
        />
      </div>

      {/* Quick actions */}
      <div className="grid sm:grid-cols-3 gap-3">
        <QuickAction
          href="/kasir/pos"
          label="POS Kasir"
          desc="Catat transaksi penjualan"
          icon={<ShoppingCart size={24} />}
          primary
        />
        <QuickAction
          href="/kasir/order/baru"
          label="Buat Order Antar"
          desc="Order walk-in lewat telp"
          icon={<Truck size={24} />}
        />
        <QuickAction
          href="/pembayaran?tab=piutang"
          label="Tandai Lunas"
          desc="Konfirmasi pembayaran piutang"
          icon={<Wallet size={24} />}
        />
      </div>

      {/* Bagikan link daftar + stat referral */}
      <div className="space-y-2">
        <ShareRegistrationButton kodeReferralStaff={kodeReferralStaff} />
        {statReferral.totalAjak > 0 && (
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-surface border border-line rounded-xl p-2">
              <div className="text-[9px] text-[color:var(--muted)] uppercase tracking-wide">
                Diajak
              </div>
              <div className="font-extrabold text-sm">{statReferral.totalAjak}</div>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2">
              <div className="text-[9px] text-emerald-700 uppercase tracking-wide">
                Aktif
              </div>
              <div className="font-extrabold text-sm text-emerald-800">
                {statReferral.totalAktif}
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-2">
              <div className="text-[9px] text-amber-700 uppercase tracking-wide">
                Bonus Pending
              </div>
              <div className="font-extrabold text-sm text-amber-800">
                {formatRupiah(statReferral.bonusPending)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Piutang saya */}
      <section className="bg-surface border border-line rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-line flex items-center justify-between">
          <div>
            <h2 className="font-bold">Piutang yang Saya Tangani</h2>
            <p className="text-xs text-[color:var(--muted)]">
              Order yang kamu input/handle, belum lunas
            </p>
          </div>
          {piutangList.length > 0 && (
            <Link
              href="/pembayaran?tab=piutang"
              className="text-xs text-brand font-bold inline-flex items-center gap-1"
            >
              Semua <ArrowRight size={11} />
            </Link>
          )}
        </div>
        {piutangList.length === 0 ? (
          <div className="p-6 text-center text-sm text-[color:var(--muted)]">
            ✓ Tidak ada piutang. Bagus!
          </div>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {piutangList.map((r) => (
              <li key={r.id}>
                <Link
                  href="/pembayaran?tab=piutang"
                  className="flex items-center justify-between gap-2 p-3 hover:bg-[color:var(--surface2)]"
                >
                  <div className="min-w-0">
                    <div className="font-mono text-xs text-brand">{r.nomorOrder}</div>
                    <div className="font-bold truncate">{r.pelangganNama ?? "—"}</div>
                    <div className="text-xs text-[color:var(--muted)]">
                      {r.createdAt.toLocaleDateString("id-ID", {
                        day: "2-digit",
                        month: "short",
                      })}
                      {r.pelangganTelp && ` · ${r.pelangganTelp}`}
                    </div>
                  </div>
                  <div className="font-extrabold text-amber-700 whitespace-nowrap">
                    {formatRupiah(r.totalEstimasi)}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Aktivitas terbaru */}
      <section className="bg-surface border border-line rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-line flex items-center justify-between">
          <div>
            <h2 className="font-bold">Transaksi Terbaru Saya</h2>
            <p className="text-xs text-[color:var(--muted)]">5 transaksi POS paling baru</p>
          </div>
          <Link
            href="/kasir/transaksi"
            className="text-xs text-brand font-bold inline-flex items-center gap-1"
          >
            Semua <ArrowRight size={11} />
          </Link>
        </div>
        {aktivitasTerbaru.length === 0 ? (
          <div className="p-6 text-center text-sm text-[color:var(--muted)]">
            Belum ada transaksi.
          </div>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {aktivitasTerbaru.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/kasir/transaksi/${r.id}`}
                  className="flex items-center justify-between gap-2 p-3 hover:bg-[color:var(--surface2)]"
                >
                  <div className="min-w-0">
                    <div className="font-mono text-xs text-brand">{r.nomorNota}</div>
                    <div className="font-bold truncate">{r.pelangganNama ?? "Walk-in"}</div>
                    <div className="text-xs text-[color:var(--muted)]">
                      {r.createdAt.toLocaleString("id-ID", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      · {(r.metodeBayar ?? "-").toUpperCase()}
                    </div>
                  </div>
                  <div className="font-extrabold text-brand whitespace-nowrap">
                    {formatRupiah(r.total)}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  subValue,
  icon,
  color,
}: {
  label: string;
  value: string;
  subValue?: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className={`rounded-2xl border border-line p-3 ${color}`}>
      <div className="flex items-center justify-between mb-1">
        <div className="text-[10px] font-bold tracking-widest opacity-80">{label}</div>
        {icon}
      </div>
      <div className="text-lg font-extrabold leading-tight">{value}</div>
      {subValue && <div className="text-[10px] opacity-80 mt-0.5">{subValue}</div>}
    </div>
  );
}

function QuickAction({
  href,
  label,
  desc,
  icon,
  primary,
}: {
  href: string;
  label: string;
  desc: string;
  icon: React.ReactNode;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`rounded-2xl border p-4 flex items-start gap-3 transition active:scale-[0.98] ${
        primary
          ? "bg-brand text-white border-brand hover:bg-brand-700"
          : "bg-surface border-line hover:bg-[color:var(--surface2)]"
      }`}
    >
      <div className={primary ? "text-white" : "text-brand"}>{icon}</div>
      <div className="min-w-0">
        <div className="font-extrabold">{label}</div>
        <div className={`text-xs ${primary ? "text-white/80" : "text-[color:var(--muted)]"}`}>
          {desc}
        </div>
      </div>
    </Link>
  );
}
