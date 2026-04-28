"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { orderHeader, orderItem } from "@/db/schema/order";
import { produk } from "@/db/schema/produk";
import { pengaturan } from "@/db/schema/pengaturan";
import { requireSession } from "@/lib/permissions";
import { getOrCreatePelanggan } from "@/lib/pelanggan";
import { generateNomorNota } from "@/lib/utils";
import { notifGrupOrder } from "@/lib/telegram";
import { pushOrder } from "@/lib/sheets";

type Jenis = "isi_ulang" | "tukar" | "beli_baru";

export type OrderInput = {
  items: { produkId: number; qty: number; jenis: Jenis }[];
  alamatAntar: string;
  jadwalAntar?: string; // ISO date-time
  catatan?: string;
};

export async function createOrder(input: OrderInput): Promise<void> {
  const session = await requireSession();
  const pel = await getOrCreatePelanggan(session.user.id, session.user.name);

  if (input.items.length === 0) throw new Error("Pilih minimal satu produk");
  if (!input.alamatAntar.trim()) throw new Error("Alamat pengantaran wajib diisi");

  const ids = [...new Set(input.items.map((i) => i.produkId))];
  const produkRows = await db.query.produk.findMany({
    where: inArray(produk.id, ids),
  });
  const produkMap = new Map(produkRows.map((p) => [p.id, p]));

  let totalEstimasi = 0;
  for (const it of input.items) {
    const p = produkMap.get(it.produkId);
    if (!p) throw new Error(`Produk #${it.produkId} tidak ditemukan`);
    const harga = hargaUntuk(p, it.jenis);
    totalEstimasi += harga * it.qty;
  }

  const nomorOrder = generateNomorNota("ORD");

  const newOrderId = db.transaction((tx) => {
    const [o] = tx
      .insert(orderHeader)
      .values({
        nomorOrder,
        pelangganId: pel.id,
        sumber: "web",
        alamatAntar: input.alamatAntar,
        jadwalAntar: input.jadwalAntar ? new Date(input.jadwalAntar) : null,
        status: "pending",
        totalEstimasi,
        catatan: input.catatan ?? null,
      })
      .returning()
      .all();

    for (const it of input.items) {
      const p = produkMap.get(it.produkId)!;
      tx.insert(orderItem)
        .values({
          orderId: o.id,
          produkId: it.produkId,
          qty: it.qty,
          jenis: it.jenis,
          hargaEstimasi: hargaUntuk(p, it.jenis),
        })
        .run();
    }
    return o.id;
  });

  pushOrder(newOrderId).catch((e) => console.warn("[sheets] pushOrder:", e));

  notifGrupOrder(
    "pending",
    await renderTemplate("templateNotifOrderMasukAdmin", {
      nomorOrder,
      namaPelanggan: pel.nama,
      jumlahItem: String(input.items.reduce((s, i) => s + i.qty, 0)),
      totalEstimasi: totalEstimasi.toLocaleString("id-ID"),
      alamatAntar: input.alamatAntar,
    }),
  ).catch(() => {});

  revalidatePath("/pelanggan/beranda");
  revalidatePath("/pelanggan/riwayat");
  revalidatePath("/admin/order");
  revalidatePath("/kasir/order");

  redirect(`/pelanggan/beranda?ok=${nomorOrder}`);
}

function hargaUntuk(p: typeof produk.$inferSelect, jenis: Jenis): number {
  return jenis === "isi_ulang"
    ? p.hargaIsiUlang
    : jenis === "tukar"
      ? p.hargaTukar
      : p.hargaBeliBaru;
}

/**
 * Pelanggan batalkan order miliknya sendiri.
 * Hanya boleh kalau status masih "pending" (belum diproses kasir).
 */
export async function cancelOrderByPelanggan(
  orderId: number,
  alasan?: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireSession();
  const pel = await getOrCreatePelanggan(session.user.id, session.user.name);

  const order = await db.query.orderHeader.findFirst({
    where: eq(orderHeader.id, orderId),
  });
  if (!order) return { ok: false, error: "Order tidak ditemukan" };
  if (order.pelangganId !== pel.id) {
    return { ok: false, error: "Order ini bukan milik Anda" };
  }
  if (order.status !== "pending") {
    return {
      ok: false,
      error:
        "Order sudah diproses kasir. Hubungi admin via WhatsApp untuk pembatalan.",
    };
  }

  const catatanBaru = alasan
    ? `${order.catatan ?? ""}\n[Dibatalkan pelanggan: ${alasan}]`.trim()
    : order.catatan;

  await db
    .update(orderHeader)
    .set({ status: "batal", catatan: catatanBaru, updatedAt: new Date() })
    .where(eq(orderHeader.id, orderId));

  // Notif grup Telegram (status batal)
  notifGrupOrder(
    "batal",
    `❌ *${order.nomorOrder}* dibatalkan oleh *pelanggan* (${pel.nama}).${alasan ? `\nAlasan: ${alasan}` : ""}`,
  ).catch(() => {});

  revalidatePath("/pelanggan/beranda");
  revalidatePath("/pelanggan/riwayat");
  revalidatePath("/admin/order");
  revalidatePath("/kasir/order");

  return { ok: true };
}

async function renderTemplate(key: string, vars: Record<string, string>): Promise<string> {
  const row = await db.query.pengaturan.findFirst({
    where: eq(pengaturan.key, key),
  });
  let text = row?.value ?? "";
  for (const [k, v] of Object.entries(vars)) {
    text = text.replaceAll(`{${k}}`, v);
  }
  return text || `Order ${vars.nomorOrder ?? ""}`;
}
