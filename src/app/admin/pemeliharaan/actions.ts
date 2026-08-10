"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { filter, filterLog } from "@/db/schema/filter";
import { pengeluaran } from "@/db/schema/pengeluaran";
import { requireRole } from "@/lib/permissions";
import { getKategoriById } from "@/lib/kategori-biaya";

type SaveFilterInput = {
  id?: number;
  nama: string;
  kategori: "carbon" | "sediment" | "membran_ro" | "uv_lamp" | "lainnya";
  intervalHari: number;
  catatan?: string;
  /** FK ke master kategori_biaya (opsional). Kalau ada, dipakai untuk amortisasi. */
  kategoriBiayaId?: number | null;
  /** Harga beli untuk amortisasi (opsional). */
  hargaBeli?: number | null;
  /** Tanggal pasang (opsional, default = sekarang untuk record baru). */
  tanggalPasang?: string | null;
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

  // Validasi kategoriBiayaId kalau ada — harus valid + tipe sparepart
  let kategoriBiayaId: number | null = input.kategoriBiayaId ?? null;
  if (kategoriBiayaId) {
    const kat = await getKategoriById(kategoriBiayaId);
    if (!kat) return { error: "Kategori biaya tidak ditemukan di master" };
    if (kat.tipe !== "sparepart") {
      return { error: "Kategori harus bertipe 'sparepart' untuk amortisasi" };
    }
  }

  const hargaBeli =
    input.hargaBeli && input.hargaBeli > 0 ? Math.floor(input.hargaBeli) : null;
  const tanggalPasang = input.tanggalPasang
    ? new Date(input.tanggalPasang)
    : null;

  const data = {
    nama,
    kategori: input.kategori,
    kategoriBiayaId,
    intervalHari: input.intervalHari,
    hargaBeli,
    tanggalPasang: tanggalPasang && !isNaN(tanggalPasang.getTime()) ? tanggalPasang : null,
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
 *
 * Untuk sparepart amortisasi (filter yang di-link ke master):
 *  - Reset tanggalPasang ke tanggal ganti (mulai periode amortisasi baru)
 *  - Update hargaBeli kalau ada harga baru (track historical price)
 *  - Auto-create pengeluaran dengan kategori dari master (bukan hardcoded)
 */
export async function catatGantiFilter(args: {
  filterId: number;
  gantiAt: string; // ISO date YYYY-MM-DD
  biaya?: number;
  catatan?: string;
  alasanGanti?: string;
  trackKePengeluaran?: boolean;
}): Promise<{ ok: true } | { error: string }> {
  const session = await requireRole(["admin"]);
  const tanggal = new Date(args.gantiAt);
  if (isNaN(tanggal.getTime())) return { error: "Tanggal tidak valid" };
  const biaya = args.biaya && args.biaya > 0 ? Math.round(args.biaya) : 0;

  const f = await db.query.filter.findFirst({ where: eq(filter.id, args.filterId) });
  if (!f) return { error: "Filter tidak ditemukan" };

  // Gabung catatan + alasan ganti (kalau ada)
  const catatanLog = [args.catatan?.trim(), args.alasanGanti?.trim()]
    .filter(Boolean)
    .join(" · ") || null;

  // Resolve kategori master kalau ada (untuk klasifikasi pengeluaran)
  let kategoriSlug = "filter"; // fallback lama
  let kategoriBiayaId: number | null = null;
  if (f.kategoriBiayaId) {
    const kat = await getKategoriById(f.kategoriBiayaId);
    if (kat) {
      kategoriSlug = kat.slug;
      kategoriBiayaId = kat.id;
    }
  }

  await db.transaction((tx) => {
    tx.insert(filterLog)
      .values({
        filterId: args.filterId,
        gantiAt: tanggal,
        gantiBy: session.user.id,
        biaya,
        catatan: catatanLog,
      })
      .run();

    // Update filter:
    //  - gantiTerakhir = tanggal ganti
    //  - tanggalPasang = tanggal ganti (mulai periode amortisasi baru)
    //  - hargaBeli = update kalau ada biaya baru (track harga historis)
    const filterUpdate: {
      gantiTerakhir: Date;
      tanggalPasang: Date;
      hargaBeli?: number;
      updatedAt: Date;
    } = {
      gantiTerakhir: tanggal,
      tanggalPasang: tanggal,
      updatedAt: new Date(),
    };
    if (biaya > 0) {
      filterUpdate.hargaBeli = biaya;
    }
    tx.update(filter)
      .set(filterUpdate)
      .where(eq(filter.id, args.filterId))
      .run();

    // Auto-track ke pengeluaran kalau biaya > 0 dan flag aktif
    if (biaya > 0 && args.trackKePengeluaran !== false) {
      tx.insert(pengeluaran)
        .values({
          tanggal,
          kategori: kategoriSlug,
          kategoriBiayaId,
          jumlah: biaya,
          deskripsi: `Ganti ${f.nama}${catatanLog ? ` — ${catatanLog}` : ""}`,
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
    revalidatePath("/admin/laporan/laba");
  }
  return { ok: true };
}
