"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq, inArray, like, or } from "drizzle-orm";
import { db } from "@/db";
import { orderHeader, orderItem } from "@/db/schema/order";
import { produk } from "@/db/schema/produk";
import { pelanggan as pelangganTable } from "@/db/schema/pelanggan";
import { requireRole } from "@/lib/permissions";
import { generateNomorNota } from "@/lib/utils";
import { generateTrackingToken } from "@/lib/tracking";
import { resolveShiftId } from "@/lib/shift";
import { notifGrupOrder } from "@/lib/telegram";
import { sendWhatsAppGroup } from "@/lib/whatsapp";
import { pengaturan as pengaturanTable } from "@/db/schema/pengaturan";
import { pushOrder } from "@/lib/sheets";

type Jenis = "isi_ulang" | "tukar" | "beli_baru";

export type WalkInOrderInput = {
  pelangganId?: number; // existing
  pelangganBaru?: { nama: string; telp?: string; alamat?: string };
  items: { produkId: number; qty: number; jenis: Jenis }[];
  alamatAntar: string;
  tipePengantaran: "antar-saja" | "jemput-antar";
  jadwalAntar?: string;
  catatan?: string;
};

export async function searchPelanggan(
  q: string,
): Promise<{
  id: number;
  nama: string;
  telp: string | null;
  alamat: string | null;
  saldoLoyalti: number;
}[]> {
  await requireRole(["admin", "kasir"]);
  const term = `%${q.trim()}%`;
  if (!q.trim()) return [];
  const rows = await db
    .select({
      id: pelangganTable.id,
      nama: pelangganTable.nama,
      telp: pelangganTable.telp,
      alamat: pelangganTable.alamat,
      saldoLoyalti: pelangganTable.saldoLoyalti,
    })
    .from(pelangganTable)
    .where(or(like(pelangganTable.nama, term), like(pelangganTable.telp, term)))
    .limit(10);
  return rows;
}

export async function createWalkInOrder(input: WalkInOrderInput): Promise<void> {
  const session = await requireRole(["admin", "kasir"]);
  if (input.items.length === 0) throw new Error("Pilih minimal satu produk");
  if (!input.alamatAntar.trim()) throw new Error("Alamat pengantaran wajib diisi");

  // Resolve shift untuk auto-tag order ke shift kasir yang aktif
  const resolvedShiftId = await resolveShiftId({ userId: session.user.id });
  if (!resolvedShiftId) {
    throw new Error(
      "Tidak ada shift aktif. Buka shift dulu di /kasir/shift sebelum input order.",
    );
  }

  // Resolve pelangganId
  let pelangganId = input.pelangganId ?? null;
  let pelangganNama = "Walk-in";
  if (!pelangganId && input.pelangganBaru?.nama) {
    const [created] = await db
      .insert(pelangganTable)
      .values({
        nama: input.pelangganBaru.nama.trim(),
        telp: input.pelangganBaru.telp?.trim() || null,
        alamat: input.pelangganBaru.alamat?.trim() || input.alamatAntar,
        tipe: "umum",
      })
      .returning();
    pelangganId = created.id;
    pelangganNama = created.nama;
  } else if (pelangganId) {
    const p = await db.query.pelanggan.findFirst({ where: eq(pelangganTable.id, pelangganId) });
    if (p) pelangganNama = p.nama;
  }

  // Ambil info pelanggan untuk notif (telp + koordinat)
  const pelInfo = pelangganId
    ? await db.query.pelanggan.findFirst({ where: eq(pelangganTable.id, pelangganId) })
    : null;

  const ids = [...new Set(input.items.map((i) => i.produkId))];
  const produkRows = await db.query.produk.findMany({ where: inArray(produk.id, ids) });
  const produkMap = new Map(produkRows.map((p) => [p.id, p]));

  let totalEstimasi = 0;
  for (const it of input.items) {
    const p = produkMap.get(it.produkId);
    if (!p) throw new Error(`Produk #${it.produkId} tidak ditemukan`);
    totalEstimasi += hargaUntuk(p, it.jenis) * it.qty;
  }

  const nomorOrder = generateNomorNota("ORD");

  const newOrderId = db.transaction((tx) => {
    const [o] = tx
      .insert(orderHeader)
      .values({
        nomorOrder,
        pelangganId,
        sumber: "walk-in",
        alamatAntar: input.alamatAntar,
        jadwalAntar: input.jadwalAntar ? new Date(input.jadwalAntar) : null,
        status: "pending",
        tipePengantaran: input.tipePengantaran,
        totalEstimasi,
        catatan: input.catatan ?? null,
        trackingToken: generateTrackingToken(),
        shiftId: resolvedShiftId,
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

  pushOrder(newOrderId).catch(() => {});

  const linkMaps =
    pelInfo?.koordinatLat != null && pelInfo?.koordinatLng != null
      ? `https://www.google.com/maps?q=${pelInfo.koordinatLat},${pelInfo.koordinatLng}`
      : "";
  const notifText = [
    `🆕 *${nomorOrder}* (walk-in)`,
    `Pelanggan: ${pelangganNama}`,
    pelInfo?.telp ? `WA: ${pelInfo.telp}` : "",
    `Total est: ${totalEstimasi.toLocaleString("id-ID")}`,
    input.tipePengantaran === "jemput-antar" ? "🔄 jemput-isi-antar" : "Antar saja",
    input.alamatAntar ? `Alamat: ${input.alamatAntar}` : "",
    linkMaps ? `Lokasi: ${linkMaps}` : "",
    `Dibuat oleh: ${session.user.name}`,
  ]
    .filter(Boolean)
    .join("\n");
  notifGrupOrder("pending", notifText).catch(() => {});

  // Notif ke grup WhatsApp depot (kalau dikonfigurasi)
  (async () => {
    const groupIdRow = await db.query.pengaturan.findFirst({
      where: eq(pengaturanTable.key, "waGroupOrderMasuk"),
    });
    const groupId = groupIdRow?.value?.trim();
    if (groupId) {
      await sendWhatsAppGroup(groupId, notifText).catch(() => {});
    }
  })().catch(() => {});

  revalidatePath("/kasir/order");
  revalidatePath("/admin/order");
  redirect(`/kasir/order?ok=${nomorOrder}`);
}

function hargaUntuk(p: typeof produk.$inferSelect, jenis: Jenis): number {
  return jenis === "isi_ulang"
    ? p.hargaIsiUlang
    : jenis === "tukar"
      ? p.hargaTukar
      : p.hargaBeliBaru;
}
