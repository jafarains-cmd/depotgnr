import { eq, desc, sql } from "drizzle-orm";
import { db } from "@/db";
import { bonusReferralStaff } from "@/db/schema/referral-staff";
import { user as userTable } from "@/db/schema/auth";
import { pelanggan as pelangganTable } from "@/db/schema/pelanggan";
import { PageHeader } from "@/components/AppShell";
import { requireRole } from "@/lib/permissions";
import { formatRupiah } from "@/lib/utils";
import { BonusStaffClient, type StaffSummary, type BonusRow } from "./BonusStaffClient";
import { PageSizeSelect } from "@/components/PageSizeSelect";
import { Pagination } from "@/components/Pagination";
import { parseLimit, parsePage, getPagination } from "@/lib/page-size";

export const dynamic = "force-dynamic";

export default async function BonusStaffPage({
  searchParams,
}: {
  searchParams: Promise<{ limit?: string; page?: string }>;
}) {
  await requireRole(["admin"]);
  const sp = await searchParams;
  const limit = parseLimit(sp.limit);
  const pageParam = parsePage(sp.page);

  const [countRow] = await db.select({ n: sql<number>`count(*)` }).from(bonusReferralStaff);
  const total = countRow?.n ?? 0;
  const { page, totalPages, offset } = getPagination({ total, limit, page: pageParam });

  // Aggregate per staff
  const summary = await db
    .select({
      staffUserId: bonusReferralStaff.staffUserId,
      pendingTotal: sql<number>`coalesce(sum(case when ${bonusReferralStaff.status} = 'pending' then ${bonusReferralStaff.nominal} else 0 end), 0)`,
      pendingCount: sql<number>`coalesce(sum(case when ${bonusReferralStaff.status} = 'pending' then 1 else 0 end), 0)`,
      paidTotal: sql<number>`coalesce(sum(case when ${bonusReferralStaff.status} = 'dibayar' then ${bonusReferralStaff.nominal} else 0 end), 0)`,
      totalPelanggan: sql<number>`count(*)`,
      staffNama: userTable.name,
      staffRole: userTable.role,
    })
    .from(bonusReferralStaff)
    .leftJoin(userTable, eq(bonusReferralStaff.staffUserId, userTable.id))
    .groupBy(bonusReferralStaff.staffUserId);

  const staffSummary: StaffSummary[] = summary.map((s) => ({
    staffUserId: s.staffUserId,
    staffNama: s.staffNama ?? "—",
    staffRole: s.staffRole ?? "staff",
    pendingTotal: s.pendingTotal,
    pendingCount: s.pendingCount,
    paidTotal: s.paidTotal,
    totalPelanggan: s.totalPelanggan,
  }));

  // Detail
  const detail = await db
    .select({
      id: bonusReferralStaff.id,
      staffNama: userTable.name,
      pelangganId: bonusReferralStaff.pelangganId,
      pelangganNama: pelangganTable.nama,
      nominal: bonusReferralStaff.nominal,
      status: bonusReferralStaff.status,
      paidAt: bonusReferralStaff.paidAt,
      createdAt: bonusReferralStaff.createdAt,
    })
    .from(bonusReferralStaff)
    .leftJoin(userTable, eq(bonusReferralStaff.staffUserId, userTable.id))
    .leftJoin(pelangganTable, eq(bonusReferralStaff.pelangganId, pelangganTable.id))
    .orderBy(desc(bonusReferralStaff.createdAt))
    .limit(limit)
    .offset(offset);

  const detailRows: BonusRow[] = detail.map((d) => ({
    id: d.id,
    staffNama: d.staffNama ?? "—",
    pelangganNama: d.pelangganNama ?? `#${d.pelangganId}`,
    nominal: d.nominal,
    status: d.status,
    paidAt: d.paidAt?.toISOString() ?? null,
    createdAt: d.createdAt.toISOString(),
  }));

  const totalPending = staffSummary.reduce((s, k) => s + k.pendingTotal, 0);

  return (
    <div className="p-4 md:p-6 max-w-5xl">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
        <PageHeader
          title="Bonus Referral Staff"
          description="Bonus per pelanggan baru aktif yang di-ajak kasir/admin/kurir. Tandai 'Dibayar' setelah Anda transfer."
        />
        <PageSizeSelect value={limit} />
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4">
        <div className="text-xs font-bold tracking-widest text-amber-800">
          TOTAL UTANG BONUS KE STAFF
        </div>
        <div className="text-3xl font-extrabold text-amber-900 mt-1">
          {formatRupiah(totalPending)}
        </div>
        <div className="text-xs text-amber-800 mt-1">
          Akumulasi dari semua staff, belum dibayar.
        </div>
      </div>

      <BonusStaffClient summary={staffSummary} detail={detailRows} />
      <Pagination page={page} totalPages={totalPages} total={total} />
    </div>
  );
}
