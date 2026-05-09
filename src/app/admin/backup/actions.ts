"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/permissions";
import { runBackup } from "@/lib/backup";

export async function triggerBackupNow(): Promise<
  { ok: true; sizeBytes: number; url: string } | { error: string }
> {
  const session = await requireRole(["admin"]);
  const r = await runBackup({
    triggeredBy: "manual",
    triggeredByUserId: session.user.id,
  });
  revalidatePath("/admin/backup");
  if ("error" in r) return { error: r.error };
  return { ok: true, sizeBytes: r.sizeBytes, url: r.url };
}
