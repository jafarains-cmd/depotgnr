"use server";

import { revalidatePath } from "next/cache";
import { eq, and, ne } from "drizzle-orm";
import { db } from "@/db";
import { komplain, komplainPesan } from "@/db/schema/komplain";
import { pelanggan as pelangganTable } from "@/db/schema/pelanggan";
import { requireSession } from "@/lib/permissions";
import { sendWhatsApp } from "@/lib/whatsapp";
import { sendPushToUser } from "@/lib/push";
import { bestEffort } from "@/lib/best-effort";

/**
 * Kirim pesan ke thread komplain. Otorisasi:
 * - pelanggan: hanya boleh kirim di komplain miliknya
 * - admin/kasir: boleh kirim di komplain manapun
 *
 * Side effect: tandai pesan lawan sebagai sudah dibaca + kirim notif WA/Push
 * ke lawan kalau ada.
 */
export async function kirimPesanKomplain(
  komplainId: number,
  pesan: string,
): Promise<{ ok: true } | { error: string }> {
  const session = await requireSession();
  const role = session.user.role;
  const isStaff = role === "admin" || role === "kasir";

  const teks = pesan.trim();
  if (teks.length === 0) return { error: "Pesan kosong" };
  if (teks.length > 2000) return { error: "Pesan terlalu panjang (max 2000)" };

  const k = await db.query.komplain.findFirst({
    where: eq(komplain.id, komplainId),
  });
  if (!k) return { error: "Komplain tidak ditemukan" };

  // Pelanggan hanya boleh kirim di komplain miliknya
  if (!isStaff) {
    const pel = await db.query.pelanggan.findFirst({
      where: eq(pelangganTable.id, k.pelangganId),
    });
    if (pel?.userId !== session.user.id) {
      return { error: "Komplain ini bukan milik Anda" };
    }
  }

  const senderRole: "pelanggan" | "staff" = isStaff ? "staff" : "pelanggan";

  await db.insert(komplainPesan).values({
    komplainId,
    senderUserId: session.user.id,
    senderRole,
    pesan: teks,
  });

  // Tandai pesan lawan sebagai dibaca (saya buka thread dan kirim pesan = saya baca semua)
  const otherRole = isStaff ? "pelanggan" : "staff";
  await db
    .update(komplainPesan)
    .set({ readByOther: true })
    .where(
      and(
        eq(komplainPesan.komplainId, komplainId),
        eq(komplainPesan.senderRole, otherRole),
        eq(komplainPesan.readByOther, false),
      ),
    );

  // Update komplain.updatedAt supaya admin tahu ada aktivitas baru
  await db
    .update(komplain)
    .set({ updatedAt: new Date() })
    .where(eq(komplain.id, komplainId));

  // Best-effort notif ke lawan
  if (isStaff) {
    // Notif ke pelanggan
    const pel = await db.query.pelanggan.findFirst({
      where: eq(pelangganTable.id, k.pelangganId),
    });
    if (pel?.telp) {
      bestEffort(
        "notifWApelangganKomplain",
        sendWhatsApp(
          pel.telp,
          `💬 Balasan komplain #${komplainId} dari ${session.user.name}:\n\n${teks}\n\nBalas di aplikasi: /komplain/${komplainId}`,
        ),
      );
    }
    if (pel?.userId) {
      sendPushToUser(pel.userId, {
        title: "💬 Balasan Komplain",
        body: teks.slice(0, 80),
        url: `/komplain/${komplainId}`,
        tag: `komplain-${komplainId}`,
      }).catch(() => {});
    }
  }
  // Note: notif ke staff (untuk pesan pelanggan) di-handle via badge polling
  // di admin layout. Tidak perlu WA spam ke admin tiap pesan masuk.

  void ne;
  revalidatePath(`/komplain/${komplainId}`);
  revalidatePath("/admin/komplain");
  revalidatePath("/pelanggan/komplain");
  return { ok: true };
}

/**
 * Tandai semua pesan dari lawan sebagai sudah dibaca (saat user buka thread).
 */
export async function tandaiBacaKomplain(komplainId: number): Promise<void> {
  const session = await requireSession();
  const role = session.user.role;
  const isStaff = role === "admin" || role === "kasir";
  const otherRole = isStaff ? "pelanggan" : "staff";

  await db
    .update(komplainPesan)
    .set({ readByOther: true })
    .where(
      and(
        eq(komplainPesan.komplainId, komplainId),
        eq(komplainPesan.senderRole, otherRole),
        eq(komplainPesan.readByOther, false),
      ),
    );
}
