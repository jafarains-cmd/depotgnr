"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { filter, filterLog } from "@/db/schema/filter";
import { pengeluaran } from "@/db/schema/pengeluaran";
import { requireRole } from "@/lib/permissions";

type SaveFilterInput = {
  id?: number;
  nama: string;
  kategori: "carbon" | "sediment" | "membran_ro" | "uv_lamp" | "lainnya";
  intervalHari: number;
  catatan?: string;
};

export async function saveFilter(
  input: SaveFilterInput,
): Promise<{ ok: true; id: number } | { error: string }> {
  await requireRole(["admin"]);
  const nama = input.nama.trim();
  if (!nama) return { error: "Nama filter wajib diisi" };
  if (!Number.isInteger(input.intervalHari) || input.intervalHari < 1) {
    return { error: "Interval hari harus angka bulat positif" };
  }
  if (input.intervalHari > 3650) return { error: "Interval terlalu panjang (>10 tahun)" };

  const data = {
    nama,
    kategori: input.kategori,
    intervalHari: input.intervalHari,
    catatan: input.catatan?.trim() || null,
    updatedAt: new Date(),
  };

  if (input.id) {
    await db.update(filter).set(data).where(eq(filter.id, input.id));
    revalidatePath("/admin/pemeliharaan");
    return { ok: true, id: input.id };
  }

  const [row] = await db.insert(filter).values(data).returning({ id: filter.id });
  revalidatePath("/admin/pemeliharaan");
  return { ok: true, id: row.id };
}

export async function deleteFilter(id: number): Promise<{ ok: true } | { error: string }> {
  await requireRole(["admin"]);
  await db.delete(filter).where(eq(filter.id, id));
  revalidatePath("/admin/pemeliharaan");
  return { ok: true };
}

export async function toggleFilterAktif(
  id: number,
  aktif: boolean,
): Promise<{ ok: true } | { error: string }> {
  await requireRole(["admin"]);
  await db
    .update(filter)
    .set({ aktif, updatedAt: new Date() })
    .where(eq(filter.id, id));
  revalidatePath("/admin/pemeliharaan");
  return { ok: true };
}

/**
 * Catat penggantian filter. Update gantiTerakhir + insert ke filterLog.
 * Optional: kalau biaya > 0, auto-create entry di pengeluaran (kategori filter).
 */
export async function catatGantiFilter(args: {
  filterId: number;
  gantiAt: string; // ISO date YYYY-MM-DD
  biaya?: number;
  catatan?: string;
  trackKePengeluaran?: boolean;
}): Promise<{ ok: true } | { error: string }> {
  const session = await requireRole(["admin"]);
  const tanggal = new Date(args.gantiAt);
  if (isNaN(tanggal.getTime())) return { error: "Tanggal tidak valid" };
  const biaya = args.biaya && args.biaya > 0 ? Math.round(args.biaya) : 0;

  const f = await db.query.filter.findFirst({ where: eq(filter.id, args.filterId) });
  if (!f) return { error: "Filter tidak ditemukan" };

  await db.transaction((tx) => {
    tx.insert(filterLog)
      .values({
        filterId: args.filterId,
        gantiAt: tanggal,
        gantiBy: session.user.id,
        biaya,
        catatan: args.catatan?.trim() || null,
      })
      .run();
    tx.update(filter)
      .set({ gantiTerakhir: tanggal, updatedAt: new Date() })
      .where(eq(filter.id, args.filterId))
      .run();

    // Auto-track ke pengeluaran kalau biaya > 0 dan flag aktif
    if (biaya > 0 && args.trackKePengeluaran !== false) {
      tx.insert(pengeluaran)
        .values({
          tanggal,
          kategori: "filter",
          jumlah: biaya,
          deskripsi: `Ganti ${f.nama}${args.catatan ? ` — ${args.catatan}` : ""}`,
          createdBy: session.user.id,
          updatedAt: new Date(),
        })
        .run();
    }
  });

  revalidatePath("/admin/pemeliharaan");
  revalidatePath("/admin/dashboard");
  if (biaya > 0) {
    revalidatePath("/admin/pengeluaran");
    revalidatePath("/admin/laporan");
  }
  return { ok: true };
}
