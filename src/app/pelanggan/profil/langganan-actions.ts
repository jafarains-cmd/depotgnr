"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { pelanggan } from "@/db/schema/pelanggan";
import { requireSession } from "@/lib/permissions";
import { getOrCreatePelanggan } from "@/lib/pelanggan";
import { uploadKtpLangganan } from "@/lib/drive";
import { user as userTable } from "@/db/schema/auth";
import { pengaturan } from "@/db/schema/pengaturan";
import { sendPushToUser } from "@/lib/push";
import { sendWhatsAppGroup } from "@/lib/whatsapp";

export type SubmitResult = { ok: true } | { ok: false; error: string };

/**
 * Pelanggan submit permohonan langganan: upload foto KTP, ubah tipe jadi
 * langganan_pending, tunggu admin verify.
 *
 * Idempotent-ish: kalau sudah pernah submit + still pending → replace foto.
 * Kalau sudah verified → tolak (tidak perlu submit lagi).
 */
export async function submitLangganan(args: {
  base64: string;
  mimeType: string;
}): Promise<SubmitResult> {
  const session = await requireSession();
  const pel = await getOrCreatePelanggan(session.user.id, session.user.name);

  if (pel.tipe === "langganan") {
    return { ok: false, error: "Anda sudah terdaftar sebagai langganan." };
  }

  // Wajib alamat + telp diisi
  if (!pel.alamat || !pel.telp) {
    return {
      ok: false,
      error: "Lengkapi alamat + nomor WhatsApp di profil sebelum ajukan langganan.",
    };
  }

  const uploaded = await uploadKtpLangganan({
    pelangganId: pel.id,
    base64: args.base64,
    mimeType: args.mimeType,
  });
  if (!uploaded.ok || !uploaded.url) {
    return { ok: false, error: uploaded.error ?? "Gagal upload foto KTP" };
  }

  const now = new Date();
  await db
    .update(pelanggan)
    .set({
      tipe: "langganan_pending",
      ktpFotoUrl: uploaded.url,
      ktpUploadedAt: now,
      ktpDitolakAlasan: null,
      updatedAt: now,
    })
    .where(eq(pelanggan.id, pel.id));

  revalidatePath("/pelanggan/profil");
  revalidatePath("/admin/langganan-pending");

  // Notif ke semua admin: ada pengajuan baru (FCM push per-user)
  const admins = await db
    .select({ id: userTable.id })
    .from(userTable)
    .where(eq(userTable.role, "admin"));
  await Promise.all(
    admins.map((a) =>
      sendPushToUser(a.id, {
        title: "Pengajuan Langganan Baru",
        body: `${pel.nama} mengajukan jadi langganan, tunggu verifikasi Anda.`,
        url: "/admin/langganan-pending",
        tag: `langganan-pending-${pel.id}`,
      }).catch(() => {}),
    ),
  );

  // Broadcast ke grup WA admin (reuse waGroupOrderMasuk kalau waGroupLangganan
  // kosong). Best-effort, tidak block response ke pelanggan.
  const [waGroupLangganan, waGroupOrder] = await Promise.all([
    db.query.pengaturan.findFirst({ where: eq(pengaturan.key, "waGroupLangganan") }),
    db.query.pengaturan.findFirst({ where: eq(pengaturan.key, "waGroupOrderMasuk") }),
  ]);
  const groupId = waGroupLangganan?.value?.trim() || waGroupOrder?.value?.trim();
  if (groupId) {
    const waText =
      `📋 *Pengajuan Langganan Baru*\n\n` +
      `Nama: *${pel.nama}*\n` +
      (pel.telp ? `WA: ${pel.telp}\n` : "") +
      (pel.alamat ? `Alamat: ${pel.alamat}\n` : "") +
      `\nBuka /admin/langganan-pending untuk verify.`;
    void sendWhatsAppGroup(groupId, waText);
  }

  return { ok: true };
}
