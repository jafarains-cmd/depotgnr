"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user as userTable } from "@/db/schema/auth";
import { requireRole } from "@/lib/permissions";
import { auth } from "@/lib/auth";

export async function createStaff(formData: FormData) {
  await requireRole(["admin"]);

  const role = String(formData.get("role") ?? "kasir") as "admin" | "kasir" | "kurir";
  const nama = String(formData.get("nama") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!nama || !password) throw new Error("Nama & password wajib");
  if (!email && !username) throw new Error("Email atau username wajib");

  const finalEmail = email || `${username}@${role}.depot.local`;

  const result = await auth.api.signUpEmail({
    body: {
      name: nama,
      email: finalEmail,
      password,
      ...(username ? { username } : {}),
    },
  });

  if (!result?.user) throw new Error("Gagal buat user");

  await db.update(userTable).set({ role }).where(eq(userTable.id, result.user.id));

  revalidatePath("/admin/users");
}

export async function updateUserRole(id: string, role: "admin" | "kasir" | "kurir" | "pelanggan") {
  await requireRole(["admin"]);
  await db.update(userTable).set({ role, updatedAt: new Date() }).where(eq(userTable.id, id));
  revalidatePath("/admin/users");
}

export async function banUser(id: string, reason: string) {
  await requireRole(["admin"]);
  await db
    .update(userTable)
    .set({ banned: true, banReason: reason, updatedAt: new Date() })
    .where(eq(userTable.id, id));
  revalidatePath("/admin/users");
}

export async function unbanUser(id: string) {
  await requireRole(["admin"]);
  await db
    .update(userTable)
    .set({ banned: false, banReason: null, updatedAt: new Date() })
    .where(eq(userTable.id, id));
  revalidatePath("/admin/users");
}
