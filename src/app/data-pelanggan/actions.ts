"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { pelanggan, mutasiLoyalti } from "@/db/schema/pelanggan";
import { requireRole } from "@/lib/permissions";

export async function upsertPelanggan(formData: FormData) {
  // Admin & kasir boleh create/edit
  await requireRole(["admin", "kasir"]);
  const idRaw = formData.get("id");
  const id = idRaw ? Number(idRaw) : null;
  const latRaw = String(formData.get("koordinatLat") ?? "").trim();
  const lngRaw = String(formData.get("koordinatLng") ?? "").trim();
  const data = {
    nama: String(formData.get("nama") ?? "").trim(),
    telp: String(formData.get("telp") ?? "").trim() || null,
    alamat: String(formData.get("alamat") ?? "").trim() || null,
    tipe: (formData.get("tipe") === "langganan" ? "langganan" : "umum") as "umum" | "langganan",
    catatan: String(formData.get("catatan") ?? "").trim() || null,
    koordinatLat: latRaw ? Number(latRaw) : null,
    koordinatLng: lngRaw ? Number(lngRaw) : null,
    updatedAt: new Date(),
  };
  if (!data.nama) throw new Error("Nama wajib diisi");

  if (id) {
    await db.update(pelanggan).set(data).where(eq(pelanggan.id, id));
  } else {
    await db.insert(pelanggan).values(data);
  }
  revalidatePath("/data-pelanggan");
}

export async function deletePelanggan(id: number) {
  await requireRole(["admin"]);
  await db.delete(pelanggan).where(eq(pelanggan.id, id));
  revalidatePath("/data-pelanggan");
}

/**
 * Adjust manual saldo loyalti pelanggan (admin only).
 * Insert mutasi tipe `adjust` + update saldo (max 0 supaya tidak minus).
 */
export async function adjustLoyaltyManual(
  pelangganId: number,
  jumlah: number,
  alasan: string,
): Promise<{ ok: true } | { error: string }> {
  await requireRole(["admin"]);
  const reason = alasan.trim();
  if (reason.length < 3) return { error: "Alasan wajib diisi (min 3 karakter)" };
  if (reason.length > 500) return { error: "Alasan terlalu panjang (max 500 karakter)" };
  if (!Number.isInteger(jumlah) || jumlah === 0) {
    return { error: "Jumlah harus angka bulat selain nol" };
  }
  if (Math.abs(jumlah) > 10_000_000) {
    return { error: "Jumlah di luar batas wajar (max ±10.000.000)" };
  }

  const pel = await db.query.pelanggan.findFirst({ where: eq(pelanggan.id, pelangganId) });
  if (!pel) return { error: "Pelanggan tidak ditemukan" };

  await db.transaction((tx) => {
    tx.insert(mutasiLoyalti)
      .values({
        pelangganId,
        jumlah,
        tipe: "adjust",
        deskripsi: `Adjust manual: ${reason}`,
      })
      .run();
    if (jumlah > 0) {
      tx.update(pelanggan)
        .set({ saldoLoyalti: sql`${pelanggan.saldoLoyalti} + ${jumlah}` })
        .where(eq(pelanggan.id, pelangganId))
        .run();
    } else {
      tx.update(pelanggan)
        .set({ saldoLoyalti: sql`max(0, ${pelanggan.saldoLoyalti} + ${jumlah})` })
        .where(eq(pelanggan.id, pelangganId))
        .run();
    }
  });

  revalidatePath(`/data-pelanggan/${pelangganId}`);
  revalidatePath("/data-pelanggan");
  return { ok: true };
}
