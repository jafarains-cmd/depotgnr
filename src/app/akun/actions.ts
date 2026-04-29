"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { user as userTable, account as accountTable } from "@/db/schema/auth";
import { auth } from "@/lib/auth";
import { requireSession } from "@/lib/permissions";

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
