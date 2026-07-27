import { and, eq, sql, desc, gte } from "drizzle-orm";
import { db } from "@/db";
import { orderHeader } from "@/db/schema/order";
import { pelanggan } from "@/db/schema/pelanggan";
import { reminderPiutang } from "@/db/schema/reminder-piutang";
import { pengaturan } from "@/db/schema/pengaturan";
import { formatRupiah } from "./utils";

const DAY_MS = 24 * 60 * 60 * 1000;

// Stage config: min days since order untuk eligible reminder
export const STAGE_DAYS: Record<1 | 2 | 3, number> = {
  1: 7,
  2: 14,
  3: 30,
};

export type StageNum = 1 | 2 | 3;

export type PiutangReminderRow = {
  orderId: number;
  nomorOrder: string;
  pelangganId: number | null;
  pelangganNama: string;
  pelangganTelp: string | null;
  totalPiutang: number;
  totalOrder: number;
  paidPartial: number;
  createdAt: Date;
  daysAge: number;
  currentStage: StageNum; // Stage yang eligible sekarang
  lastReminderStage: StageNum | null; // Stage terakhir yang sudah dikirim
  needsReminder: boolean; // True kalau currentStage > lastReminderStage
};

/**
 * Normalize nomor telp ke format 62xxx (untuk wa.me link).
 * "0812xxx" → "62812xxx"
 * "62812xxx" → "62812xxx"
 * "+62812xxx" → "62812xxx"
 * "812xxx" → "62812xxx"
 */
export function normalizePhoneForWa(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return null;
  if (digits.startsWith("62")) return digits;
  if (digits.startsWith("0")) return "62" + digits.slice(1);
  return "62" + digits;
}

/**
 * Ambil semua piutang menua yang eligible untuk reminder,
 * lengkap dengan info stage berapa yang perlu dikirim.
 */
export async function getPiutangUntukReminder(): Promise<PiutangReminderRow[]> {
  const now = Date.now();
  const cutoffStage1 = new Date(now - STAGE_DAYS[1] * DAY_MS);

  // Ambil semua order piutang (selesai + belum lunas) yang umur >= 7 hari
  const rows = await db
    .select({
      orderId: orderHeader.id,
      nomorOrder: orderHeader.nomorOrder,
      pelangganId: orderHeader.pelangganId,
      pelangganNama: pelanggan.nama,
      pelangganTelp: pelanggan.telp,
      totalOrder: orderHeader.totalEstimasi,
      paidPartial: orderHeader.paidPartial,
      createdAt: orderHeader.createdAt,
    })
    .from(orderHeader)
    .leftJoin(pelanggan, eq(orderHeader.pelangganId, pelanggan.id))
    .where(
      and(
        eq(orderHeader.status, "selesai"),
        eq(orderHeader.statusBayar, "belum"),
        sql`${orderHeader.createdAt} <= ${cutoffStage1.toISOString()}`,
      ),
    )
    .orderBy(desc(orderHeader.createdAt));

  const orderIds = rows.map((r) => r.orderId);
  if (orderIds.length === 0) return [];

  // Ambil last reminder per order (stage tertinggi yang sudah dikirim)
  const lastReminders = await db
    .select({
      orderId: reminderPiutang.orderId,
      maxStage: sql<number>`max(${reminderPiutang.stage})`,
    })
    .from(reminderPiutang)
    .where(sql`${reminderPiutang.orderId} in ${orderIds}`)
    .groupBy(reminderPiutang.orderId);

  const lastReminderMap = new Map<number, StageNum>();
  for (const r of lastReminders) {
    lastReminderMap.set(r.orderId, Number(r.maxStage) as StageNum);
  }

  return rows.map((r) => {
    const daysAge = Math.floor((now - r.createdAt.getTime()) / DAY_MS);
    const totalPiutang = r.totalOrder - r.paidPartial;

    // Tentukan stage saat ini: paling tinggi yang sudah lewat threshold
    let currentStage: StageNum = 1;
    if (daysAge >= STAGE_DAYS[3]) currentStage = 3;
    else if (daysAge >= STAGE_DAYS[2]) currentStage = 2;

    const lastReminderStage = lastReminderMap.get(r.orderId) ?? null;
    const needsReminder =
      lastReminderStage === null || currentStage > lastReminderStage;

    return {
      orderId: r.orderId,
      nomorOrder: r.nomorOrder,
      pelangganId: r.pelangganId,
      pelangganNama: r.pelangganNama ?? "walk-in",
      pelangganTelp: r.pelangganTelp,
      totalPiutang,
      totalOrder: r.totalOrder,
      paidPartial: r.paidPartial,
      createdAt: r.createdAt,
      daysAge,
      currentStage,
      lastReminderStage,
      needsReminder,
    };
  });
}

/**
 * Ambil hanya yang butuh reminder sekarang (belum di-kirim stage saat ini).
 */
export async function getPiutangNeedReminder(): Promise<PiutangReminderRow[]> {
  const all = await getPiutangUntukReminder();
  return all.filter((r) => r.needsReminder && r.pelangganTelp !== null);
}

/**
 * Template pesan WA per stage. Sopan → tegas.
 */
export function buildReminderMessage(row: {
  pelangganNama: string;
  nomorOrder: string;
  totalPiutang: number;
  createdAt: Date;
  daysAge: number;
  stage: StageNum;
  namaDepot: string;
  telpDepot?: string;
}): string {
  const tanggalOrder = row.createdAt.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const footer = row.telpDepot ? `\n\n${row.namaDepot} · WA ${row.telpDepot}` : `\n\n${row.namaDepot}`;

  if (row.stage === 1) {
    return (
      `Halo Pak/Bu ${row.pelangganNama},\n\n` +
      `Kami dari ${row.namaDepot} ingin mengingatkan piutang atas nama Anda:\n` +
      `📋 No: ${row.nomorOrder}\n` +
      `📅 Tanggal: ${tanggalOrder}\n` +
      `💰 Jumlah: ${formatRupiah(row.totalPiutang)}\n` +
      `⏰ Umur: ${row.daysAge} hari\n\n` +
      `Mohon dapat dilunasi. Terima kasih atas kerjasamanya.` +
      footer
    );
  }

  if (row.stage === 2) {
    return (
      `Pak/Bu ${row.pelangganNama},\n\n` +
      `Ini pengingat KE-2 untuk piutang:\n` +
      `📋 ${row.nomorOrder}\n` +
      `💰 ${formatRupiah(row.totalPiutang)}\n` +
      `📅 Sudah ${row.daysAge} hari sejak ${tanggalOrder}\n\n` +
      `Mohon segera dilunasi minggu ini. Kami menunggu konfirmasi Anda.` +
      footer
    );
  }

  // Stage 3
  return (
    `Pak/Bu ${row.pelangganNama},\n\n` +
    `Ini pengingat TERAKHIR untuk piutang:\n` +
    `📋 ${row.nomorOrder}\n` +
    `💰 ${formatRupiah(row.totalPiutang)}\n` +
    `📅 Sudah ${row.daysAge} hari — sangat terlambat\n\n` +
    `Mohon segera dilunasi. Kalau tidak ada konfirmasi, kami terpaksa masukkan ke daftar hitam pelanggan.` +
    footer
  );
}

/**
 * Generate URL wa.me dengan pesan pre-filled.
 * Return null kalau nomor telp tidak valid.
 */
export function buildWaLink(row: {
  pelangganNama: string;
  pelangganTelp: string | null;
  nomorOrder: string;
  totalPiutang: number;
  createdAt: Date;
  daysAge: number;
  stage: StageNum;
  namaDepot: string;
  telpDepot?: string;
}): string | null {
  const phone = normalizePhoneForWa(row.pelangganTelp);
  if (!phone) return null;
  const message = buildReminderMessage(row);
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

/**
 * Ambil nama depot dari pengaturan, fallback default.
 */
export async function getDepotContext(): Promise<{
  namaDepot: string;
  telpDepot: string | undefined;
}> {
  const [namaRow, telpRow] = await Promise.all([
    db.query.pengaturan.findFirst({ where: eq(pengaturan.key, "namaDepot") }),
    db.query.pengaturan.findFirst({ where: eq(pengaturan.key, "telpDepot") }),
  ]);
  return {
    namaDepot: namaRow?.value?.trim() || "Depot Air",
    telpDepot: telpRow?.value?.trim() || undefined,
  };
}

/**
 * History reminder per order (untuk drill-down UI).
 */
export async function getReminderHistory(orderId: number): Promise<
  Array<{ stage: StageNum; sentAt: Date; sentBy: string | null; catatan: string | null }>
> {
  const rows = await db
    .select()
    .from(reminderPiutang)
    .where(eq(reminderPiutang.orderId, orderId))
    .orderBy(desc(reminderPiutang.sentAt));
  return rows.map((r) => ({
    stage: r.stage as StageNum,
    sentAt: r.sentAt,
    sentBy: r.sentBy,
    catatan: r.catatan,
  }));
}
