"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { komplain } from "@/db/schema/komplain";
import { pelanggan as pelangganTable, mutasiLoyalti } from "@/db/schema/pelanggan";
import { user as userTable } from "@/db/schema/auth";
import { requireRole } from "@/lib/permissions";
import { sendWhatsApp } from "@/lib/whatsapp";
import { sendTelegram } from "@/lib/telegram";
import { sendPushToUser } from "@/lib/push";
import { bestEffort } from "@/lib/best-effort";

type ResolveInput = {
  id: number;
  status: "diproses" | "selesai" | "ditolak";
  resolusi?: string;
  kompensasiLoyalti?: number;
};

export async function resolveKomplain(
  input: ResolveInput,
): Promise<{ ok: true } | { error: string }> {
  const session = await requireRole(["admin"]);

  const k = await db.query.komplain.findFirst({ where: eq(komplain.id, input.id) });
  if (!k) return { error: "Komplain tidak ditemukan" };
  if (k.status === "selesai" || k.status === "ditolak") {
    return { error: "Komplain sudah ditutup" };
  }

  const resolusi = input.resolusi?.trim() ?? null;
  const kompensasi =
    input.kompensasiLoyalti && input.kompensasiLoyalti > 0
      ? Math.round(input.kompensasiLoyalti)
      : 0;

  if (input.status === "ditolak" && !resolusi) {
    return { error: "Alasan penolakan wajib diisi" };
  }

  const updateData: Partial<typeof komplain.$inferInsert> = {
    status: input.status,
    resolusi,
    kompensasiLoyalti: kompensasi,
    updatedAt: new Date(),
  };

  if (input.status === "selesai" || input.status === "ditolak") {
    updateData.resolvedAt = new Date();
    updateData.resolvedBy = session.user.id;
  }

  await db.transaction((tx) => {
    tx.update(komplain).set(updateData).where(eq(komplain.id, input.id)).run();

    // Kasih kompensasi loyalty kalau status=selesai dan kompensasi > 0
    if (input.status === "selesai" && kompensasi > 0) {
      tx.insert(mutasiLoyalti)
        .values({
          pelangganId: k.pelangganId,
          jumlah: kompensasi,
          tipe: "adjust",
          deskripsi: `Kompensasi komplain #${k.id}: ${resolusi ?? ""}`,
        })
        .run();
      tx.update(pelangganTable)
        .set({
          saldoLoyalti: sql`${pelangganTable.saldoLoyalti} + ${kompensasi}`,
        })
        .where(eq(pelangganTable.id, k.pelangganId))
        .run();
    }
  });

  // Notif pelanggan tentang update status
  bestEffort("notifKomplainPelanggan", notifKomplainPelanggan(input.id));

  revalidatePath("/admin/komplain");
  revalidatePath("/pelanggan/komplain");
  if (kompensasi > 0) {
    revalidatePath(`/data-pelanggan/${k.pelangganId}`);
  }
  return { ok: true };
}

async function notifKomplainPelanggan(komplainId: number) {
  const k = await db.query.komplain.findFirst({ where: eq(komplain.id, komplainId) });
  if (!k) return;
  const pel = await db.query.pelanggan.findFirst({
    where: eq(pelangganTable.id, k.pelangganId),
  });
  if (!pel) return;

  const statusLabel: Record<string, string> = {
    diproses: "🔄 sedang diproses",
    selesai: "✅ selesai",
    ditolak: "❌ ditolak",
  };

  const text = [
    `📋 *Update Komplain #${k.id}*`,
    `Status: ${statusLabel[k.status] ?? k.status}`,
    "",
    k.resolusi ? `Tanggapan:\n${k.resolusi}` : "",
    k.kompensasiLoyalti > 0
      ? `\nKompensasi: +${k.kompensasiLoyalti.toLocaleString("id-ID")} saldo loyalty 🎉`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  if (pel.telp) await sendWhatsApp(pel.telp, text).catch(() => {});

  if (pel.userId) {
    const u = await db.query.user.findFirst({ where: eq(userTable.id, pel.userId) });
    if (u?.telegramChatId) await sendTelegram(u.telegramChatId, text).catch(() => {});
    sendPushToUser(pel.userId, {
      title: `Komplain #${k.id} ${statusLabel[k.status] ?? ""}`,
      body: k.resolusi?.slice(0, 100) ?? "Komplain Anda telah ditangani",
      url: "/pelanggan/komplain",
      tag: `komplain-${k.id}`,
    }).catch(() => {});
  }
}
