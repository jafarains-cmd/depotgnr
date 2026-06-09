"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/permissions";
import { bayarBonusReferralStaff } from "@/lib/referral-staff";
import { logAudit } from "@/lib/audit";

export async function bayarBonusStaffAction(
  staffUserId: string,
  catatan?: string,
): Promise<{ ok: true; count: number; total: number } | { error: string }> {
  const session = await requireRole(["admin"]);
  const r = await bayarBonusReferralStaff({
    staffUserId,
    paidBy: session.user.id,
    catatan,
  });
  await logAudit({
    actorUserId: session.user.id,
    action: "bonus-referral-staff.bayar",
    entity: "bonus_referral_staff",
    entityId: staffUserId,
    after: { count: r.count, total: r.total },
    meta: { catatan },
  });
  revalidatePath("/admin/bonus-staff");
  return { ok: true, count: r.count, total: r.total };
}
