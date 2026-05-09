import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, desc, and, sql } from "drizzle-orm";
import { ArrowLeft, Coins, Star, TrendingUp, TrendingDown } from "lucide-react";
import { db } from "@/db";
import { pelanggan as pelangganTable, mutasiLoyalti } from "@/db/schema/pelanggan";
import { requireRole } from "@/lib/permissions";
import { formatRupiah } from "@/lib/utils";
import { LoyaltyAdjustForm } from "./LoyaltyAdjustForm";
import { PageSizeSelect } from "@/components/PageSizeSelect";
import { Pagination } from "@/components/Pagination";
import { parseLimit, parsePage, getPagination } from "@/lib/page-size";

export const dynamic = "force-dynamic";

const TIPE_LABEL: Record<string, { label: string; color: string }> = {
  earn: { label: "Earn", color: "text-emerald-600" },
  redeem: { label: "Redeem", color: "text-red-600" },
  referral_in: { label: "Referral", color: "text-blue-600" },
  referral_bonus: { label: "Bonus Referral", color: "text-blue-600" },
  stamp_reward: { label: "Stamp", color: "text-amber-600" },
  adjust: { label: "Adjust", color: "text-purple-600" },
};

export default async function PelangganDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ limit?: string; page?: string }>;
}) {
  const session = await requireRole(["admin", "kasir"]);
  const isAdmin = session.user.role === "admin";
  const { id } = await params;
  const sp = await searchParams;
  const limit = parseLimit(sp.limit);
  const pageParam = parsePage(sp.page);
  const pelangganId = Number(id);
  if (!pelangganId) notFound();

  const pel = await db.query.pelanggan.findFirst({
    where: eq(pelangganTable.id, pelangganId),
  });
  if (!pel) notFound();

  const [countRow] = await db
    .select({ n: sql<number>`count(*)` })
    .from(mutasiLoyalti)
    .where(eq(mutasiLoyalti.pelangganId, pelangganId));
  const totalMutasi = countRow?.n ?? 0;
  const { page, totalPages, offset } = getPagination({
    total: totalMutasi,
    limit,
    page: pageParam,
  });

  const mutasi = await db
    .select()
    .from(mutasiLoyalti)
    .where(eq(mutasiLoyalti.pelangganId, pelangganId))
    .orderBy(desc(mutasiLoyalti.createdAt))
    .limit(limit)
    .offset(offset);

  const [earnRow] = await db
    .select({ total: sql<number>`coalesce(sum(${mutasiLoyalti.jumlah}), 0)` })
    .from(mutasiLoyalti)
    .where(and(eq(mutasiLoyalti.pelangganId, pelangganId), sql`${mutasiLoyalti.jumlah} > 0`));
  const [redeemRow] = await db
    .select({ total: sql<number>`coalesce(sum(${mutasiLoyalti.jumlah}), 0)` })
    .from(mutasiLoyalti)
    .where(and(eq(mutasiLoyalti.pelangganId, pelangganId), sql`${mutasiLoyalti.jumlah} < 0`));

  const totalEarn = earnRow.total;
  const totalRedeem = Math.abs(redeemRow.total);

  return (
    <div className="p-4 md:p-6 max-w-3xl space-y-4">
      <Link
        href="/data-pelanggan"
        className="text-sm text-[color:var(--muted)] hover:text-brand inline-flex items-center gap-1"
      >
        <ArrowLeft size={14} /> Kembali
      </Link>

      <div className="bg-surface border border-line rounded-2xl p-5">
        <h1 className="text-2xl font-extrabold tracking-tight">{pel.nama}</h1>
        <div className="text-sm text-[color:var(--muted)] mt-1 space-y-0.5">
          {pel.telp && <div>📞 {pel.telp}</div>}
          {pel.alamat && <div>📍 {pel.alamat}</div>}
          <div>
            Tipe:{" "}
            <span
              className={`px-2 py-0.5 rounded-full text-xs ${
                pel.tipe === "langganan"
                  ? "bg-blue-100 text-blue-700"
                  : "bg-[color:var(--surface2)] text-[color:var(--muted)]"
              }`}
            >
              {pel.tipe}
            </span>
            {pel.kodeReferral && (
              <span className="ml-3">
                Kode referral: <span className="font-mono font-bold">{pel.kodeReferral}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat
          icon={<Coins size={16} className="text-brand" />}
          label="Saldo Loyalty"
          value={formatRupiah(pel.saldoLoyalti)}
          highlight
        />
        <Stat
          icon={<Star size={16} className="text-amber-500" />}
          label="Stamp Galon"
          value={`${pel.stampGalon}/10`}
        />
        <Stat
          icon={<TrendingUp size={16} className="text-emerald-600" />}
          label="Total Earn"
          value={formatRupiah(totalEarn)}
        />
        <Stat
          icon={<TrendingDown size={16} className="text-red-500" />}
          label="Total Redeem"
          value={formatRupiah(totalRedeem)}
        />
      </div>

      {isAdmin && <LoyaltyAdjustForm pelangganId={pel.id} />}

      <div className="flex items-center justify-end">
        <PageSizeSelect value={limit} />
      </div>

      <div className="bg-surface border border-line rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-line">
          <h2 className="font-bold">History Loyalty</h2>
          <p className="text-xs text-[color:var(--muted)]">
            {limit} mutasi terbaru · earn dari order, redeem saat bayar, atau adjust manual admin
          </p>
        </div>
        {mutasi.length === 0 ? (
          <div className="p-6 text-center text-sm text-[color:var(--muted)]">
            Belum ada mutasi loyalty.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[color:var(--surface2)] text-[color:var(--muted)] text-left text-xs">
              <tr>
                <th className="p-3">Tanggal</th>
                <th className="p-3">Tipe</th>
                <th className="p-3">Deskripsi</th>
                <th className="p-3 text-right">Jumlah</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {mutasi.map((m) => {
                const tipe = TIPE_LABEL[m.tipe] ?? { label: m.tipe, color: "text-[color:var(--muted)]" };
                return (
                  <tr key={m.id}>
                    <td className="p-3 text-xs whitespace-nowrap">
                      {m.createdAt.toLocaleString("id-ID", {
                        day: "2-digit",
                        month: "short",
                        year: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className={`p-3 text-xs font-bold ${tipe.color}`}>{tipe.label}</td>
                    <td className="p-3 text-xs text-[color:var(--muted)] max-w-xs truncate">
                      {m.deskripsi ?? "-"}
                    </td>
                    <td
                      className={`p-3 text-right font-mono font-bold whitespace-nowrap ${
                        m.jumlah > 0 ? "text-emerald-600" : "text-red-600"
                      }`}
                    >
                      {m.jumlah > 0 ? "+" : ""}
                      {formatRupiah(m.jumlah)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <Pagination page={page} totalPages={totalPages} total={totalMutasi} />
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`bg-surface border border-line rounded-2xl p-3 ${
        highlight ? "ring-2 ring-brand/40" : ""
      }`}
    >
      <div className="text-[10px] text-[color:var(--muted)] uppercase tracking-wide font-semibold inline-flex items-center gap-1">
        {icon} {label}
      </div>
      <div className="text-lg font-extrabold mt-1">{value}</div>
    </div>
  );
}
