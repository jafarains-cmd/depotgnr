"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/permissions";
import { bayarBonusKurir } from "@/lib/bonus";

export async function tandaiBayarBonus(
  kurirUserId: string,
  catatan?: string,
): Promise<{ ok: true; count: number; total: number } | { error: string }> {
  const session = await requireRole(["admin"]);
  const r = await bayarBonusKurir({
    kurirUserId,
    paidBy: session.user.id,
    catatan,
  });
  revalidatePath("/admin/bonus-kurir");
  revalidatePath("/kurir");
  return { ok: true, count: r.count, total: r.total };
}
