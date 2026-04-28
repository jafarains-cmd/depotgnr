"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { produk } from "@/db/schema/produk";
import { requireRole } from "@/lib/permissions";

export async function upsertProduk(formData: FormData) {
  await requireRole(["admin"]);

  const idRaw = formData.get("id");
  const id = idRaw ? Number(idRaw) : null;

  const data = {
    nama: String(formData.get("nama") ?? "").trim(),
    deskripsi: String(formData.get("deskripsi") ?? "").trim() || null,
    hargaIsiUlang: Number(formData.get("hargaIsiUlang") ?? 0),
    hargaTukar: Number(formData.get("hargaTukar") ?? 0),
    hargaBeliBaru: Number(formData.get("hargaBeliBaru") ?? 0),
    aktif: formData.get("aktif") === "on",
    updatedAt: new Date(),
  };

  if (!data.nama) throw new Error("Nama produk wajib diisi");

  if (id) {
    await db.update(produk).set(data).where(eq(produk.id, id));
  } else {
    await db.insert(produk).values(data);
  }

  revalidatePath("/admin/produk");
}

export async function deleteProduk(id: number) {
  await requireRole(["admin"]);
  await db.delete(produk).where(eq(produk.id, id));
  revalidatePath("/admin/produk");
}

export async function toggleAktif(id: number, aktif: boolean) {
  await requireRole(["admin"]);
  await db.update(produk).set({ aktif, updatedAt: new Date() }).where(eq(produk.id, id));
  revalidatePath("/admin/produk");
}
