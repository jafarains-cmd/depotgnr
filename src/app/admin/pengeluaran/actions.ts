"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { pengeluaran } from "@/db/schema/pengeluaran";
import { requireRole } from "@/lib/permissions";
import { uploadAsset } from "@/lib/drive";

type SaveInput = {
  id?: number;
  tanggal: string; // ISO date string YYYY-MM-DD
  kategori: string;
  jumlah: number;
  deskripsi?: string;
  fotoNotaBase64?: string;
  fotoNotaMimeType?: string;
};

export async function savePengeluaran(
  input: SaveInput,
): Promise<{ ok: true; id: number } | { error: string }> {
  const session = await requireRole(["admin"]);

  const kategori = input.kategori.trim().toLowerCase();
  if (!kategori) return { error: "Kategori wajib diisi" };
  if (!Number.isFinite(input.jumlah) || input.jumlah <= 0) {
    return { error: "Jumlah harus angka positif" };
  }
  if (input.jumlah > 1_000_000_000) {
    return { error: "Jumlah di luar batas wajar (>1M)" };
  }

  const tanggal = new Date(input.tanggal);
  if (isNaN(tanggal.getTime())) return { error: "Tanggal tidak valid" };

  let fotoUrl: string | null = null;
  if (input.fotoNotaBase64 && input.fotoNotaMimeType) {
    const up = await uploadAsset({
      prefix: "nota-pengeluaran",
      base64: input.fotoNotaBase64,
      mimeType: input.fotoNotaMimeType,
    });
    if (up.ok && up.url) fotoUrl = up.url;
  }

  const data = {
    tanggal,
    kategori,
    jumlah: Math.round(input.jumlah),
    deskripsi: input.deskripsi?.trim() || null,
    updatedAt: new Date(),
    ...(fotoUrl ? { fotoNotaUrl: fotoUrl } : {}),
  };

  if (input.id) {
    await db.update(pengeluaran).set(data).where(eq(pengeluaran.id, input.id));
    revalidatePath("/admin/pengeluaran");
    revalidatePath("/admin/dashboard");
    revalidatePath("/admin/laporan");
    return { ok: true, id: input.id };
  }

  const [row] = await db
    .insert(pengeluaran)
    .values({ ...data, createdBy: session.user.id })
    .returning({ id: pengeluaran.id });
  revalidatePath("/admin/pengeluaran");
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/laporan");
  return { ok: true, id: row.id };
}

export async function deletePengeluaran(id: number): Promise<{ ok: true } | { error: string }> {
  await requireRole(["admin"]);
  await db.delete(pengeluaran).where(eq(pengeluaran.id, id));
  revalidatePath("/admin/pengeluaran");
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/laporan");
  return { ok: true };
}
