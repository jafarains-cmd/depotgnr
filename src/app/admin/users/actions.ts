"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { user as userTable, session as sessionTable } from "@/db/schema/auth";
import { requireRole } from "@/lib/permissions";
import { auth } from "@/lib/auth";
import { generateToken, createResetToken } from "@/lib/password-reset";
import { logAudit } from "@/lib/audit";

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

/**
 * Edit data user: nama, email, username, telp, alamat.
 * Password tidak di-edit di sini — pakai /akun (self-service) atau reset password flow.
 */
export async function editUser(
  id: string,
  patch: {
    nama?: string;
    email?: string;
    username?: string | null;
    phoneNumber?: string | null;
  },
): Promise<{ ok: true } | { error: string }> {
  await requireRole(["admin"]);

  const target = await db.query.user.findFirst({ where: eq(userTable.id, id) });
  if (!target) return { error: "User tidak ditemukan" };

  const update: Partial<typeof userTable.$inferInsert> = { updatedAt: new Date() };
  if (patch.nama !== undefined) {
    const v = patch.nama.trim();
    if (!v) return { error: "Nama tidak boleh kosong" };
    update.name = v;
  }
  if (patch.email !== undefined) {
    const v = patch.email.trim();
    if (!v) return { error: "Email tidak boleh kosong" };
    // Cek unik
    const dup = await db.query.user.findFirst({
      where: and(eq(userTable.email, v), ne(userTable.id, id)),
    });
    if (dup) return { error: "Email sudah dipakai user lain" };
    update.email = v;
  }
  if (patch.username !== undefined) {
    const v = patch.username?.trim() || null;
    if (v) {
      if (!/^[a-z0-9_.]{3,30}$/.test(v.toLowerCase())) {
        return { error: "Username 3-30 huruf kecil/angka/_/." };
      }
      const dup = await db.query.user.findFirst({
        where: and(eq(userTable.username, v.toLowerCase()), ne(userTable.id, id)),
      });
      if (dup) return { error: "Username sudah dipakai" };
      update.username = v.toLowerCase();
      update.displayUsername = v;
    } else {
      update.username = null;
      update.displayUsername = null;
    }
  }
  if (patch.phoneNumber !== undefined) {
    update.phoneNumber = patch.phoneNumber?.trim() || null;
  }

  await db.update(userTable).set(update).where(eq(userTable.id, id));
  revalidatePath("/admin/users");
  return { ok: true };
}

/**
 * Hard delete user. Cascade akan menghapus session, account, push subscription.
 * Pelanggan & order yang link ke user akan ke-set NULL (sesuai schema FK).
 *
 * Guard:
 *  - Tidak bisa hapus diri sendiri (mencegah lock-out)
 *  - Tidak bisa hapus admin terakhir
 */
export async function deleteUser(
  id: string,
  mode: "soft" | "hard" = "soft",
): Promise<{ ok: true } | { error: string }> {
  const session = await requireRole(["admin"]);
  if (id === session.user.id) {
    return { error: "Tidak bisa hapus akun sendiri. Minta admin lain." };
  }

  const target = await db.query.user.findFirst({ where: eq(userTable.id, id) });
  if (!target) return { error: "User tidak ditemukan" };

  // Kalau target adalah admin, pastikan masih ada admin lain
  if (target.role === "admin") {
    const otherAdmins = await db.query.user.findMany({
      where: and(eq(userTable.role, "admin"), ne(userTable.id, id)),
    });
    if (otherAdmins.length === 0) {
      return { error: "Tidak bisa hapus admin terakhir. Buat admin baru dulu." };
    }
  }

  if (mode === "soft") {
    // Soft delete: nonaktifkan akun, history transaksi tetap tampil dengan nama asli
    await db
      .update(userTable)
      .set({
        banned: true,
        banReason: `Dinonaktifkan oleh ${session.user.name} pada ${new Date().toISOString()}`,
      })
      .where(eq(userTable.id, id));

    // Hapus semua sesi aktif user yang dinonaktifkan
    await db.delete(sessionTable).where(eq(sessionTable.userId, id));
  } else {
    // Hard delete: hapus permanen dari DB (cascade ke session via FK)
    // Data order/transaksi tetap ada (FK set null) tapi nama jadi "—"
    await db.delete(userTable).where(eq(userTable.id, id));
  }

  await logAudit({
    actorUserId: session.user.id,
    action: mode === "soft" ? "user.nonaktifkan" : "user.delete",
    entity: "user",
    entityId: id,
    before: { name: target.name, email: target.email, role: target.role },
    meta: { mode },
  });

  revalidatePath("/admin/users");
  return { ok: true };
}

/**
 * Aktifkan kembali user yang sudah dinonaktifkan (banned=true → false).
 */
export async function reactivateUser(
  id: string,
): Promise<{ ok: true } | { error: string }> {
  const session = await requireRole(["admin"]);
  const target = await db.query.user.findFirst({ where: eq(userTable.id, id) });
  if (!target) return { error: "User tidak ditemukan" };
  await db
    .update(userTable)
    .set({ banned: false, banReason: null })
    .where(eq(userTable.id, id));
  await logAudit({
    actorUserId: session.user.id,
    action: "user.reactivate",
    entity: "user",
    entityId: id,
    after: { name: target.name },
  });
  revalidatePath("/admin/users");
  return { ok: true };
}

/**
 * Generate reset password link untuk user (admin only). Pakai metode 'admin'
 * dengan expiry 24 jam. Admin kasih link ini ke user lewat channel apapun
 * (in-person, telepon). User klik link → set password baru langsung.
 */
export async function generateResetLink(
  userId: string,
): Promise<{ ok: true; url: string; expiresAt: string } | { error: string }> {
  const session = await requireRole(["admin"]);
  const target = await db.query.user.findFirst({ where: eq(userTable.id, userId) });
  if (!target) return { error: "User tidak ditemukan" };

  const token = generateToken();
  const { expiresAt } = await createResetToken({
    userId,
    method: "admin",
    token,
    createdByUserId: session.user.id,
  });

  const baseUrl = process.env.BETTER_AUTH_URL ?? "https://depot.genster.my.id";
  const url = `${baseUrl}/reset-password?token=${token}`;

  return { ok: true, url, expiresAt: expiresAt.toISOString() };
}
