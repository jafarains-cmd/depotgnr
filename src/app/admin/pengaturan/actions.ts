"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { pengaturan } from "@/db/schema/pengaturan";
import { requireRole } from "@/lib/permissions";
import { uploadAsset } from "@/lib/drive";

export async function setupTelegramWebhook(): Promise<{ ok: boolean; description?: string }> {
  await requireRole(["admin"]);
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, description: "TELEGRAM_BOT_TOKEN belum diset di .env" };
  const baseUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
  const url = `${baseUrl}/api/webhooks/telegram`;
  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  const json = (await res.json()) as { ok: boolean; description?: string };
  return json;
}

export async function deleteTelegramWebhook(): Promise<{ ok: boolean; description?: string }> {
  await requireRole(["admin"]);
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, description: "TELEGRAM_BOT_TOKEN belum diset" };
  const res = await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`, { method: "POST" });
  return (await res.json()) as { ok: boolean; description?: string };
}

export async function savePengaturan(formData: FormData) {
  await requireRole(["admin"]);
  const entries: { key: string; value: string }[] = [];
  for (const [key, value] of formData.entries()) {
    entries.push({ key, value: String(value) });
  }
  for (const e of entries) {
    await db
      .insert(pengaturan)
      .values({ key: e.key, value: e.value, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: pengaturan.key,
        set: { value: e.value, updatedAt: new Date() },
      });
  }
  revalidatePath("/admin/pengaturan");
}

export async function uploadQrisFoto(args: {
  base64: string;
  mimeType: string;
}): Promise<{ ok: true; url: string } | { error: string }> {
  await requireRole(["admin"]);
  const up = await uploadAsset({
    prefix: "qris",
    base64: args.base64,
    mimeType: args.mimeType,
  });
  if (!up.ok || !up.url) return { error: up.error ?? "Gagal upload" };

  await db
    .insert(pengaturan)
    .values({ key: "qrisFotoUrl", value: up.url, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: pengaturan.key,
      set: { value: up.url, updatedAt: new Date() },
    });

  revalidatePath("/admin/pengaturan");
  return { ok: true, url: up.url };
}
