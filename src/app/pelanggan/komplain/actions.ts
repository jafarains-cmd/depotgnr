"use server";

import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { komplain } from "@/db/schema/komplain";
import { orderHeader } from "@/db/schema/order";
import { pelanggan as pelangganTable } from "@/db/schema/pelanggan";
import { user as userTable } from "@/db/schema/auth";
import { pengaturan } from "@/db/schema/pengaturan";
import { requireSession } from "@/lib/permissions";
import { getOrCreatePelanggan } from "@/lib/pelanggan";
import { uploadAsset } from "@/lib/drive";
import { sendWhatsApp } from "@/lib/whatsapp";
import { sendTelegram, notifGrupOrder } from "@/lib/telegram";
import { bestEffort } from "@/lib/best-effort";

type SubmitInput = {
  jenis: "kotor" | "rusak" | "kurang_volume" | "salah_pesanan" | "lainnya";
  deskripsi: string;
  refOrderId?: number;
  fotoBase64?: string;
  fotoMimeType?: string;
};

const JENIS_LABEL: Record<string, string> = {
  kotor: "Galon kotor / kemasan rusak",
  rusak: "Air berbau / rasa aneh",
  kurang_volume: "Volume kurang dari standar",
  salah_pesanan: "Pesanan tidak sesuai",
  lainnya: "Lainnya",
};

export async function submitKomplain(
  input: SubmitInput,
): Promise<{ ok: true; id: number } | { error: string }> {
  const session = await requireSession();
  const me = await getOrCreatePelanggan(session.user.id, session.user.name);

  const deskripsi = input.deskripsi.trim();
  if (deskripsi.length < 5) return { error: "Deskripsi minimal 5 karakter" };
  if (deskripsi.length > 1000) return { error: "Deskripsi terlalu panjang (max 1000)" };

  // Verifikasi refOrderId milik pelanggan ini
  if (input.refOrderId) {
    const o = await db.query.orderHeader.findFirst({
      where: and(
        eq(orderHeader.id, input.refOrderId),
        eq(orderHeader.pelangganId, me.id),
      ),
    });
    if (!o) return { error: "Order tidak ditemukan" };
  }

  // Upload foto kalau ada
  let fotoUrl: string | null = null;
  if (input.fotoBase64 && input.fotoMimeType) {
    const up = await uploadAsset({
      prefix: "komplain",
      base64: input.fotoBase64,
      mimeType: input.fotoMimeType,
    });
    if (up.ok && up.url) fotoUrl = up.url;
  }

  const [row] = await db
    .insert(komplain)
    .values({
      pelangganId: me.id,
      refOrderId: input.refOrderId ?? null,
      jenis: input.jenis,
      deskripsi,
      fotoUrl,
      status: "baru",
      updatedAt: new Date(),
    })
    .returning({ id: komplain.id });

  // Notif admin via Telegram grup + WA admin (kalau ada nomor admin set)
  bestEffort("notifKomplainAdmin", notifKomplainAdmin(row.id));

  revalidatePath("/pelanggan/komplain");
  revalidatePath("/admin/komplain");
  return { ok: true, id: row.id };
}

async function notifKomplainAdmin(komplainId: number) {
  const k = await db.query.komplain.findFirst({ where: eq(komplain.id, komplainId) });
  if (!k) return;
  const pel = await db.query.pelanggan.findFirst({
    where: eq(pelangganTable.id, k.pelangganId),
  });
  if (!pel) return;

  const text = [
    `🚨 *Komplain Baru* #${k.id}`,
    `Jenis: ${JENIS_LABEL[k.jenis] ?? k.jenis}`,
    `Pelanggan: ${pel.nama}${pel.telp ? ` (${pel.telp})` : ""}`,
    `Order: ${k.refOrderId ? `#${k.refOrderId}` : "-"}`,
    "",
    k.deskripsi,
    "",
    "Tindak lanjut: /admin/komplain",
  ].join("\n");

  await notifGrupOrder("pending", text).catch(() => {});

  // Optional: kirim ke admin via WA bot kalau ada setting (skip kalau belum)
  void sendWhatsApp;
  void sendTelegram;
  void userTable;
  void pengaturan;
}

/**
 * Pelanggan tarik komplain (cuma kalau status masih 'baru' — belum diproses).
 */
export async function tarikKomplain(
  id: number,
): Promise<{ ok: true } | { error: string }> {
  const session = await requireSession();
  const me = await getOrCreatePelanggan(session.user.id, session.user.name);

  const k = await db.query.komplain.findFirst({ where: eq(komplain.id, id) });
  if (!k || k.pelangganId !== me.id) return { error: "Komplain tidak ditemukan" };
  if (k.status !== "baru") return { error: "Tidak bisa ditarik (sudah diproses)" };

  await db.delete(komplain).where(eq(komplain.id, id));
  revalidatePath("/pelanggan/komplain");
  revalidatePath("/admin/komplain");
  return { ok: true };
}
