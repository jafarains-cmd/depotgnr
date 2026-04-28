"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { pelanggan } from "@/db/schema/pelanggan";
import { requireRole } from "@/lib/permissions";

export async function upsertPelanggan(formData: FormData) {
  await requireRole(["admin"]);
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
  revalidatePath("/admin/pelanggan");
}

export async function deletePelanggan(id: number) {
  await requireRole(["admin"]);
  await db.delete(pelanggan).where(eq(pelanggan.id, id));
  revalidatePath("/admin/pelanggan");
}
