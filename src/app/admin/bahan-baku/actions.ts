"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { bahanBaku, mutasiBahanBaku } from "@/db/schema/bahan-baku";
import { pengeluaran } from "@/db/schema/pengeluaran";
import { requireRole } from "@/lib/permissions";

type SaveInput = {
  id?: number;
  nama: string;
  satuan: string;
  threshold: number;
  hargaSatuan: number;
  catatan?: string;
};

export async function saveBahanBaku(
  input: SaveInput,
): Promise<{ ok: true; id: number } | { error: string }> {
  await requireRole(["admin"]);
  const nama = input.nama.trim();
  if (!nama) return { error: "Nama wajib diisi" };
  if (input.threshold < 0) return { error: "Threshold tidak boleh negatif" };
  if (input.hargaSatuan < 0) return { error: "Harga tidak boleh negatif" };

  const data = {
    nama,
    satuan: input.satuan.trim() || "pcs",
    threshold: Math.round(input.threshold),
    hargaSatuan: Math.round(input.hargaSatuan),
    catatan: input.catatan?.trim() || null,
    updatedAt: new Date(),
  };

  if (input.id) {
    await db.update(bahanBaku).set(data).where(eq(bahanBaku.id, input.id));
    revalidatePath("/admin/bahan-baku");
    return { ok: true, id: input.id };
  }
  const [row] = await db
    .insert(bahanBaku)
    .values(data)
    .returning({ id: bahanBaku.id });
  revalidatePath("/admin/bahan-baku");
  return { ok: true, id: row.id };
}

export async function toggleBahanAktif(id: number, aktif: boolean) {
  await requireRole(["admin"]);
  await db
    .update(bahanBaku)
    .set({ aktif, updatedAt: new Date() })
    .where(eq(bahanBaku.id, id));
  revalidatePath("/admin/bahan-baku");
}

export async function deleteBahanBaku(id: number) {
  await requireRole(["admin"]);
  await db.delete(bahanBaku).where(eq(bahanBaku.id, id));
  revalidatePath("/admin/bahan-baku");
}

/**
 * Catat mutasi bahan baku (masuk/keluar). Update stok + insert mutasi.
 * Untuk masuk dengan biaya > 0, opsi auto-create entry pengeluaran kategori 'bahan-baku'.
 */
export async function catatMutasi(args: {
  bahanId: number;
  perubahan: number; // positif=masuk, negatif=keluar
  alasan: string;
  biaya?: number;
  catatan?: string;
  trackKePengeluaran?: boolean;
}): Promise<{ ok: true; stokBaru: number } | { error: string }> {
  const session = await requireRole(["admin"]);
  if (!Number.isInteger(args.perubahan) || args.perubahan === 0) {
    return { error: "Jumlah harus angka bulat selain nol" };
  }
  const alasan = args.alasan.trim();
  if (!alasan) return { error: "Alasan wajib diisi" };
  const biaya = args.biaya && args.biaya > 0 ? Math.round(args.biaya) : 0;

  const b = await db.query.bahanBaku.findFirst({ where: eq(bahanBaku.id, args.bahanId) });
  if (!b) return { error: "Bahan baku tidak ditemukan" };

  const stokBaru = Math.max(0, b.stok + args.perubahan);

  await db.transaction((tx) => {
    tx.insert(mutasiBahanBaku)
      .values({
        bahanId: args.bahanId,
        perubahan: args.perubahan,
        alasan,
        biaya,
        catatan: args.catatan?.trim() || null,
        userId: session.user.id,
      })
      .run();
    tx.update(bahanBaku)
      .set({
        stok: sql`max(0, ${bahanBaku.stok} + ${args.perubahan})`,
        updatedAt: new Date(),
      })
      .where(eq(bahanBaku.id, args.bahanId))
      .run();

    // Auto-track pengeluaran kalau MASUK + ada biaya
    if (args.perubahan > 0 && biaya > 0 && args.trackKePengeluaran !== false) {
      tx.insert(pengeluaran)
        .values({
          tanggal: new Date(),
          kategori: "lain-lain",
          jumlah: biaya,
          deskripsi: `Beli ${b.nama} ${args.perubahan} ${b.satuan}${
            args.catatan ? ` — ${args.catatan}` : ""
          }`,
          createdBy: session.user.id,
          updatedAt: new Date(),
        })
        .run();
    }
  });

  revalidatePath("/admin/bahan-baku");
  revalidatePath("/admin/dashboard");
  if (biaya > 0) {
    revalidatePath("/admin/pengeluaran");
    revalidatePath("/admin/laporan");
  }
  return { ok: true, stokBaru };
}
