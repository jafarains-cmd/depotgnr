"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { user as userTable, account as accountTable } from "@/db/schema/auth";
import { pelanggan as pelangganTable } from "@/db/schema/pelanggan";
import { auth } from "@/lib/auth";
import { requireSession } from "@/lib/permissions";

export async function setNamaAction(
  rawNama: string,
): Promise<{ ok: true } | { error: string }> {
  const session = await requireSession();
  const nama = rawNama.trim();
  if (nama.length < 2) return { error: "Nama minimal 2 karakter" };
  if (nama.length > 60) return { error: "Nama maksimal 60 karakter" };

  // Update user.name
  await db
    .update(userTable)
    .set({ name: nama, updatedAt: new Date() })
    .where(eq(userTable.id, session.user.id));

  // Sinkronisasi ke pelanggan.nama kalau record ada
  const pel = await db.query.pelanggan.findFirst({
    where: eq(pelangganTable.userId, session.user.id),
  });
  if (pel) {
    await db
      .update(pelangganTable)
      .set({ nama, updatedAt: new Date() })
      .where(eq(pelangganTable.id, pel.id));
  }

  revalidatePath("/akun");
  revalidatePath("/pelanggan/profil");
  revalidatePath("/pelanggan/beranda");
  return { ok: true };
}

export async function setAlamatAction(
  rawAlamat: string,
): Promise<{ ok: true } | { error: string }> {
  const session = await requireSession();
  const alamat = rawAlamat.trim();
  if (alamat.length > 500) return { error: "Alamat maksimal 500 karakter" };

  // Pastikan record pelanggan ada (auto-create kalau belum)
  let pel = await db.query.pelanggan.findFirst({
    where: eq(pelangganTable.userId, session.user.id),
  });
  if (!pel) {
    const [created] = await db
      .insert(pelangganTable)
      .values({
        userId: session.user.id,
        nama: session.user.name,
        alamat: alamat || null,
      })
      .returning();
    pel = created;
  } else {
    await db
      .update(pelangganTable)
      .set({ alamat: alamat || null, updatedAt: new Date() })
      .where(eq(pelangganTable.id, pel.id));
  }

  revalidatePath("/akun");
  revalidatePath("/pelanggan/profil");
  revalidatePath("/pelanggan/order-baru");
  return { ok: true };
}

export async function setUsernameAction(
  rawUsername: string,
): Promise<{ ok: true } | { error: string }> {
  const session = await requireSession();
  const username = rawUsername.trim().toLowerCase();

  if (!/^[a-z0-9_.]{3,30}$/.test(username)) {
    return { error: "Username hanya huruf kecil, angka, titik & underscore (3–30 karakter)" };
  }

  const existing = await db.query.user.findFirst({
    where: and(eq(userTable.username, username), ne(userTable.id, session.user.id)),
  });
  if (existing) return { error: "Username sudah dipakai" };

  await db
    .update(userTable)
    .set({ username, displayUsername: rawUsername.trim(), updatedAt: new Date() })
    .where(eq(userTable.id, session.user.id));

  revalidatePath("/akun");
  return { ok: true };
}

export async function setPasswordAction(
  newPassword: string,
  currentPassword?: string,
): Promise<{ ok: true } | { error: string }> {
  const session = await requireSession();
  if (newPassword.length < 6) return { error: "Password minimal 6 karakter" };

  const cred = await db.query.account.findFirst({
    where: and(
      eq(accountTable.userId, session.user.id),
      eq(accountTable.providerId, "credential"),
    ),
  });

  try {
    if (cred?.password) {
      if (!currentPassword) return { error: "Password lama wajib diisi" };
      await auth.api.changePassword({
        body: { currentPassword, newPassword },
        headers: await headers(),
      });
    } else {
      await auth.api.setPassword({
        body: { newPassword },
        headers: await headers(),
      });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gagal menyimpan password";
    return { error: msg };
  }

  revalidatePath("/akun");
  return { ok: true };
}
