import { eq, desc, sql } from "drizzle-orm";
import { db } from "@/db";
import { bonusKurir } from "@/db/schema/bonus";
import { user as userTable } from "@/db/schema/auth";
import { orderHeader } from "@/db/schema/order";
import { pelanggan as pelangganTable } from "@/db/schema/pelanggan";
import { PageHeader } from "@/components/AppShell";
import { requireRole } from "@/lib/permissions";
import { formatRupiah } from "@/lib/utils";
import { BonusClient, type KurirSummary, type BonusRow } from "./BonusClient";
import { PageSizeSelect } from "@/components/PageSizeSelect";
import { Pagination } from "@/components/Pagination";
import { parseLimit, parsePage, getPagination } from "@/lib/page-size";

export const dynamic = "force-dynamic";

export default async function BonusKurirPage({
  searchParams,
}: {
  searchParams: Promise<{ limit?: string; page?: string }>;
}) {
  await requireRole(["admin"]);
  const sp = await searchParams;
  const limit = parseLimit(sp.limit);
  const pageParam = parsePage(sp.page);

  const [countRow] = await db.select({ n: sql<number>`count(*)` }).from(bonusKurir);
  const total = countRow?.n ?? 0;
  const { page, totalPages, offset } = getPagination({ total, limit, page: pageParam });

  // Aggregate per kurir: pending + paid totals + count
  const summary = await db
    .select({
      kurirUserId: bonusKurir.kurirUserId,
      pendingTotal: sql<number>`coalesce(sum(case when ${bonusKurir.status} = 'pending' then ${bonusKurir.total} else 0 end), 0)`,
      pendingCount: sql<number>`coalesce(sum(case when ${bonusKurir.status} = 'pending' then 1 else 0 end), 0)`,
      paidTotal: sql<number>`coalesce(sum(case when ${bonusKurir.status} = 'dibayar' then ${bonusKurir.total} else 0 end), 0)`,
      totalGalon: sql<number>`coalesce(sum(${bonusKurir.jumlahGalon}), 0)`,
      kurirNama: userTable.name,
      kurirEmail: userTable.email,
      kurirRole: userTable.role,
    })
    .from(bonusKurir)
    .leftJoin(userTable, eq(bonusKurir.kurirUserId, userTable.id))
    .groupBy(bonusKurir.kurirUserId);

  const kurirSummary: KurirSummary[] = summary.map((s) => ({
    kurirUserId: s.kurirUserId,
    kurirNama: s.kurirNama ?? "—",
    kurirRole: s.kurirRole ?? "kurir",
    pendingTotal: s.pendingTotal,
    pendingCount: s.pendingCount,
    paidTotal: s.paidTotal,
    totalGalon: s.totalGalon,
  }));

  const detail = await db
    .select({
      id: bonusKurir.id,
      kurirNama: userTable.name,
      orderId: bonusKurir.orderId,
      nomorOrder: orderHeader.nomorOrder,
      pelangganNama: pelangganTable.nama,
      jumlahGalon: bonusKurir.jumlahGalon,
      ratePerGalon: bonusKurir.ratePerGalon,
      total: bonusKurir.total,
      status: bonusKurir.status,
      paidAt: bonusKurir.paidAt,
      createdAt: bonusKurir.createdAt,
    })
    .from(bonusKurir)
    .leftJoin(userTable, eq(bonusKurir.kurirUserId, userTable.id))
    .leftJoin(orderHeader, eq(bonusKurir.orderId, orderHeader.id))
    .leftJoin(pelangganTable, eq(orderHeader.pelangganId, pelangganTable.id))
    .orderBy(desc(bonusKurir.createdAt))
    .limit(limit)
    .offset(offset);

  const detailRows: BonusRow[] = detail.map((d) => ({
    id: d.id,
    orderId: d.orderId,
    kurirNama: d.kurirNama ?? "—",
    nomorOrder: d.nomorOrder ?? `#${d.orderId}`,
    pelangganNama: d.pelangganNama ?? "—",
    jumlahGalon: d.jumlahGalon,
    ratePerGalon: d.ratePerGalon,
    total: d.total,
    status: d.status,
    paidAt: d.paidAt?.toISOString() ?? null,
    createdAt: d.createdAt.toISOString(),
  }));

  const totalPending = kurirSummary.reduce((s, k) => s + k.pendingTotal, 0);

  return (
    <div className="p-4 md:p-6 max-w-5xl">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
        <PageHeader
          title="Bonus Kurir"
          description="Bonus per pengantaran. Tandai 'Dibayar' setelah Anda transfer ke kurir."
        />
        <PageSizeSelect value={limit} />
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4">
        <div className="text-xs font-bold tracking-widest text-amber-800">
          TOTAL UTANG KE KURIR
        </div>
        <div className="text-3xl font-extrabold text-amber-900 mt-1">
          {formatRupiah(totalPending)}
        </div>
        <div className="text-xs text-amber-800 mt-1">
          Akumulasi dari semua kurir, belum dibayar.
        </div>
      </div>

      <BonusClient summary={kurirSummary} detail={detailRows} />
      <Pagination page={page} totalPages={totalPages} total={total} />
    </div>
  );
}
