"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { pelanggan } from "@/db/schema/pelanggan";
import { requireRole } from "@/lib/permissions";
import { sendWhatsApp } from "@/lib/whatsapp";
import { sendPushToUser } from "@/lib/push";

export type Result = { ok: true } | { ok: false; error: string };

export async function verifyLangganan(pelangganId: number): Promise<Result> {
  const session = await requireRole(["admin"]);
  const now = new Date();

  const pel = await db.query.pelanggan.findFirst({ where: eq(pelanggan.id, pelangganId) });
  if (!pel) return { ok: false, error: "Pelanggan tidak ditemukan" };
  if (pel.tipe !== "langganan_pending") {
    return { ok: false, error: "Status pelanggan bukan pending" };
  }

  await db
    .update(pelanggan)
    .set({
      tipe: "langganan",
      ktpVerifiedAt: now,
      ktpVerifiedBy: session.user.id,
      ktpDitolakAlasan: null,
      updatedAt: now,
    })
    .where(eq(pelanggan.id, pelangganId));

  // Notif ke pelanggan
  if (pel.telp) {
    void sendWhatsApp(
      pel.telp,
      `✅ *Selamat!*\n\nPengajuan langganan Anda di DEPOT GNR sudah *disetujui*. Sekarang Anda bisa order dengan pinjaman galon depot.\n\nCek profil Anda di app untuk detail limit pinjaman.`,
    );
  }
  if (pel.userId) {
    void sendPushToUser(pel.userId, {
      title: "Langganan Disetujui ✓",
      body: "Anda sekarang bisa order dengan pinjaman galon depot.",
      url: "/pelanggan/profil",
      tag: "langganan-verified",
    });
  }

  revalidatePath("/admin/langganan-pending");
  revalidatePath("/pelanggan/profil");
  return { ok: true };
}

export async function rejectLangganan(
  pelangganId: number,
  alasan: string,
): Promise<Result> {
  await requireRole(["admin"]);
  const alasanTrim = alasan.trim();
  if (alasanTrim.length < 5) {
    return { ok: false, error: "Alasan minimal 5 karakter" };
  }

  const pel = await db.query.pelanggan.findFirst({ where: eq(pelanggan.id, pelangganId) });
  if (!pel) return { ok: false, error: "Pelanggan tidak ditemukan" };
  if (pel.tipe !== "langganan_pending") {
    return { ok: false, error: "Status pelanggan bukan pending" };
  }

  await db
    .update(pelanggan)
    .set({
      tipe: "langganan_ditolak",
      ktpDitolakAlasan: alasanTrim,
      updatedAt: new Date(),
    })
    .where(eq(pelanggan.id, pelangganId));

  if (pel.telp) {
    void sendWhatsApp(
      pel.telp,
      `❌ *Pengajuan langganan ditolak*\n\nMohon maaf, pengajuan langganan Anda di DEPOT GNR ditolak.\n\n*Alasan:* ${alasanTrim}\n\nAnda bisa mengajukan ulang dengan foto KTP yang lebih baik dari menu profil.`,
    );
  }
  if (pel.userId) {
    void sendPushToUser(pel.userId, {
      title: "Pengajuan Langganan Ditolak",
      body: alasanTrim,
      url: "/pelanggan/profil",
      tag: "langganan-rejected",
    });
  }

  revalidatePath("/admin/langganan-pending");
  return { ok: true };
}

export async function updateLimitGalon(
  pelangganId: number,
  limit: number | null,
): Promise<Result> {
  await requireRole(["admin"]);
  if (limit !== null && (!Number.isInteger(limit) || limit < 0 || limit > 1000)) {
    return { ok: false, error: "Limit harus antara 0 dan 1000, atau kosongkan untuk pakai default" };
  }
  await db.update(pelanggan).set({ limitGalon: limit, updatedAt: new Date() }).where(eq(pelanggan.id, pelangganId));
  revalidatePath(`/data-pelanggan/${pelangganId}`);
  return { ok: true };
}
