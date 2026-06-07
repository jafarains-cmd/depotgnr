"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { produk } from "@/db/schema/produk";
import { requireRole } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

export async function upsertProduk(formData: FormData) {
  const session = await requireRole(["admin"]);

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
    const before = await db.query.produk.findFirst({ where: eq(produk.id, id) });
    await db.update(produk).set(data).where(eq(produk.id, id));
    await logAudit({
      actorUserId: session.user.id,
      action: "produk.update",
      entity: "produk",
      entityId: id,
      before,
      after: data,
    });
  } else {
    const [created] = await db.insert(produk).values(data).returning();
    await logAudit({
      actorUserId: session.user.id,
      action: "produk.create",
      entity: "produk",
      entityId: created.id,
      after: data,
    });
  }

  revalidatePath("/admin/produk");
}

export async function deleteProduk(id: number) {
  const session = await requireRole(["admin"]);
  const before = await db.query.produk.findFirst({ where: eq(produk.id, id) });
  await db.delete(produk).where(eq(produk.id, id));
  await logAudit({
    actorUserId: session.user.id,
    action: "produk.delete",
    entity: "produk",
    entityId: id,
    before,
  });
  revalidatePath("/admin/produk");
}

export async function toggleAktif(id: number, aktif: boolean) {
  const session = await requireRole(["admin"]);
  await db.update(produk).set({ aktif, updatedAt: new Date() }).where(eq(produk.id, id));
  await logAudit({
    actorUserId: session.user.id,
    action: aktif ? "produk.aktifkan" : "produk.nonaktifkan",
    entity: "produk",
    entityId: id,
    after: { aktif },
  });
  revalidatePath("/admin/produk");
}
