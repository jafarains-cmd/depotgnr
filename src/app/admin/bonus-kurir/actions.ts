"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/permissions";
import { bayarBonusKurir, bayarBonusKurirPartial } from "@/lib/bonus";

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

/**
 * Bayar bonus kurir dengan jumlah custom (uang pas). Sisa tetap pending.
 */
export async function bayarBonusPartialAction(args: {
  kurirUserId: string;
  jumlahBayar: number;
  catatan?: string;
}): Promise<
  | { ok: true; count: number; totalPaid: number; sisaTidakTerpakai: number }
  | { error: string }
> {
  const session = await requireRole(["admin"]);
  if (!Number.isFinite(args.jumlahBayar) || args.jumlahBayar <= 0) {
    return { error: "Jumlah bayar harus > 0" };
  }
  const r = await bayarBonusKurirPartial({
    kurirUserId: args.kurirUserId,
    jumlahBayar: Math.floor(args.jumlahBayar),
    paidBy: session.user.id,
    catatan: args.catatan,
  });
  revalidatePath("/admin/bonus-kurir");
  revalidatePath("/kurir");
  return {
    ok: true,
    count: r.count,
    totalPaid: r.totalPaid,
    sisaTidakTerpakai: r.sisaTidakTerpakai,
  };
}
