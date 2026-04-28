"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user as userTable } from "@/db/schema/auth";
import { requireSession } from "@/lib/permissions";
import { createTelegramLinkCode } from "@/lib/telegram";

export async function generateTelegramLink(): Promise<{ code: string }> {
  const session = await requireSession();
  const code = await createTelegramLinkCode(session.user.id);
  revalidatePath("/pelanggan/profil");
  return { code };
}

export async function unlinkTelegram() {
  const session = await requireSession();
  await db.update(userTable).set({ telegramChatId: null }).where(eq(userTable.id, session.user.id));
  revalidatePath("/pelanggan/profil");
}
