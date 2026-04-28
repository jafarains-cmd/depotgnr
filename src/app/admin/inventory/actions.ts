"use server";

import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { stokGalon, mutasiStok } from "@/db/schema/inventory";
import { requireRole } from "@/lib/permissions";

type Status = "kosong" | "terisi" | "rusak";

export async function mutasiManual(formData: FormData) {
  const session = await requireRole(["admin"]);

  const produkId = Number(formData.get("produkId"));
  const status = String(formData.get("status")) as Status;
  const perubahan = Number(formData.get("perubahan"));
  const alasan = String(formData.get("alasan") ?? "").trim();

  if (!produkId || !alasan) throw new Error("Produk & alasan wajib diisi");
  if (!perubahan || isNaN(perubahan)) throw new Error("Perubahan tidak valid (gunakan negatif untuk kurang)");

  db.transaction((tx) => {
    const existing = tx
      .select()
      .from(stokGalon)
      .where(and(eq(stokGalon.produkId, produkId), eq(stokGalon.status, status)))
      .all();
    const row = existing[0];
    if (row) {
      tx.update(stokGalon)
        .set({ jumlah: Math.max(0, row.jumlah + perubahan), updatedAt: new Date() })
        .where(eq(stokGalon.id, row.id))
        .run();
    } else {
      tx.insert(stokGalon)
        .values({ produkId, status, jumlah: Math.max(0, perubahan) })
        .run();
    }
    tx.insert(mutasiStok)
      .values({
        produkId,
        status,
        perubahan,
        alasan: `manual:${alasan}`,
        userId: session.user.id,
      })
      .run();
  });

  revalidatePath("/admin/inventory");
  revalidatePath("/admin/dashboard");
}
