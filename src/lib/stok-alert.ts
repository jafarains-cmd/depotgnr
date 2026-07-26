import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { produk } from "@/db/schema/produk";
import { stokGalon } from "@/db/schema/inventory";
import { pengaturan } from "@/db/schema/pengaturan";
import { notifAdminTelegram } from "./telegram";

const DAY_MS = 24 * 60 * 60 * 1000;
const PINJAM_MACET_THRESHOLD_DAYS = 30;
const ALERT_KEY_PREFIX = "stok_alert_last_sent_";
const DIGEST_KEY = "pinjam_macet_digest_last_sent";

export type StokRendahRow = {
  produkId: number;
  nama: string;
  brand: string | null;
  stokTerisi: number;
  stokMinimal: number;
  kekurangan: number;
};

export type PinjamMacetRow = {
  pelangganId: number;
  nama: string;
  telp: string | null;
  totalGalon: number;
  lastOrderAt: Date | null;
  daysSinceLastOrder: number | null;
};

/**
 * Produk dengan stok terisi <= stokMinimal (yang enabled).
 * Skip produk dengan stokMinimal = 0 (alert disabled).
 */
export async function getStokRendah(): Promise<StokRendahRow[]> {
  const rows = await db
    .select({
      produkId: produk.id,
      nama: produk.nama,
      brand: produk.brand,
      stokMinimal: produk.stokMinimal,
      stokTerisi: sql<number>`coalesce((
        select ${stokGalon.jumlah}
        from ${stokGalon}
        where ${stokGalon.produkId} = ${produk.id}
          and ${stokGalon.status} = 'terisi'
        limit 1
      ), 0)`,
    })
    .from(produk)
    .where(and(eq(produk.aktif, true), sql`${produk.stokMinimal} > 0`));

  return rows
    .filter((r) => Number(r.stokTerisi) <= Number(r.stokMinimal))
    .map((r) => ({
      produkId: r.produkId,
      nama: r.nama,
      brand: r.brand,
      stokTerisi: Number(r.stokTerisi),
      stokMinimal: Number(r.stokMinimal),
      kekurangan: Math.max(0, Number(r.stokMinimal) - Number(r.stokTerisi)),
    }));
}

/**
 * Pelanggan yang pinjam galon tapi tidak order > 30 hari.
 * Kandidat follow-up (galon kemungkinan hilang / pelanggan pindah).
 */
export async function getPelangganPinjamMacet(): Promise<PinjamMacetRow[]> {
  const cutoffMs = Date.now() - PINJAM_MACET_THRESHOLD_DAYS * DAY_MS;
  const cutoffSeconds = Math.floor(cutoffMs / 1000);

  const rows = await db.all<{
    pelanggan_id: number;
    nama: string;
    telp: string | null;
    total_galon: number;
    last_order_at: number | null;
  }>(sql`
    SELECT
      p.id AS pelanggan_id,
      p.nama,
      p.telp,
      COALESCE(SUM(gd.jumlah), 0) AS total_galon,
      (
        SELECT MAX(o.created_at)
        FROM \`order\` o
        WHERE o.pelanggan_id = p.id
      ) AS last_order_at
    FROM pelanggan p
    JOIN galon_dipinjam gd ON gd.pelanggan_id = p.id
    GROUP BY p.id
    HAVING total_galon > 0
      AND (last_order_at IS NULL OR last_order_at < ${cutoffSeconds})
    ORDER BY (last_order_at IS NULL) DESC, last_order_at ASC
    LIMIT 20
  `);

  const now = Date.now();
  return rows.map((r) => {
    const lastMs = r.last_order_at ? Number(r.last_order_at) * 1000 : null;
    return {
      pelangganId: Number(r.pelanggan_id),
      nama: r.nama,
      telp: r.telp,
      totalGalon: Number(r.total_galon),
      lastOrderAt: lastMs ? new Date(lastMs) : null,
      daysSinceLastOrder: lastMs
        ? Math.floor((now - lastMs) / DAY_MS)
        : null,
    };
  });
}

/**
 * Cek apakah alert sudah dikirim untuk produk ini hari ini.
 * Simpan flag di pengaturan pakai key `stok_alert_last_sent_{id}` = YYYY-MM-DD.
 */
async function alertAlreadySentToday(produkId: number): Promise<boolean> {
  const key = `${ALERT_KEY_PREFIX}${produkId}`;
  const row = await db.query.pengaturan.findFirst({
    where: eq(pengaturan.key, key),
  });
  if (!row?.value) return false;
  const today = new Date().toISOString().slice(0, 10);
  return row.value === today;
}

async function markAlertSent(produkId: number): Promise<void> {
  const key = `${ALERT_KEY_PREFIX}${produkId}`;
  const today = new Date().toISOString().slice(0, 10);
  const existing = await db.query.pengaturan.findFirst({
    where: eq(pengaturan.key, key),
  });
  if (existing) {
    await db
      .update(pengaturan)
      .set({ value: today, updatedAt: new Date() })
      .where(eq(pengaturan.key, key));
  } else {
    await db.insert(pengaturan).values({ key, value: today });
  }
}

/**
 * Cek stok rendah dan kirim notif Telegram (best-effort, idempotent per hari).
 */
export async function cekDanKirimAlertStokRendah(): Promise<{
  checked: number;
  sent: number;
}> {
  const stokRendah = await getStokRendah();
  let sent = 0;

  for (const s of stokRendah) {
    if (await alertAlreadySentToday(s.produkId)) continue;

    const displayName = s.brand ? `${s.nama} (${s.brand})` : s.nama;
    const message = [
      `🚨 STOK RENDAH — ${displayName}`,
      ``,
      `Stok terisi: ${s.stokTerisi} galon`,
      `Minimum: ${s.stokMinimal} galon`,
      `Kekurangan: ${s.kekurangan} galon`,
      ``,
      `Waktu produksi/isi ulang lagi.`,
    ].join("\n");

    try {
      await notifAdminTelegram(message);
      await markAlertSent(s.produkId);
      sent++;
    } catch (err) {
      console.warn(`[stok-alert] Gagal kirim notif ${displayName}:`, err);
    }
  }

  return { checked: stokRendah.length, sent };
}

/**
 * Weekly digest — ringkasan pelanggan pinjam macet.
 * Idempotent per minggu (Senin sebagai anchor).
 */
export async function kirimDigestPinjamMacet(): Promise<{
  count: number;
  sent: boolean;
}> {
  const macet = await getPelangganPinjamMacet();
  if (macet.length === 0) return { count: 0, sent: false };

  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const weekKey = monday.toISOString().slice(0, 10);
  const row = await db.query.pengaturan.findFirst({
    where: eq(pengaturan.key, DIGEST_KEY),
  });
  if (row?.value === weekKey) return { count: macet.length, sent: false };

  const lines = [
    `📋 PELANGGAN PINJAM GALON MACET (>${PINJAM_MACET_THRESHOLD_DAYS} hari tanpa order)`,
    ``,
    `Total: ${macet.length} pelanggan`,
    ``,
  ];
  const top = macet.slice(0, 10);
  for (const p of top) {
    const days = p.daysSinceLastOrder ?? 999;
    lines.push(
      `• ${p.nama} — ${p.totalGalon} galon (${days}h tanpa order)${p.telp ? ` · ${p.telp}` : ""}`,
    );
  }
  if (macet.length > 10) {
    lines.push(``, `...dan ${macet.length - 10} pelanggan lainnya`);
  }
  lines.push(``, `Cek: /admin/galon-dipinjam untuk follow-up.`);

  try {
    await notifAdminTelegram(lines.join("\n"));
    if (row) {
      await db
        .update(pengaturan)
        .set({ value: weekKey, updatedAt: new Date() })
        .where(eq(pengaturan.key, DIGEST_KEY));
    } else {
      await db
        .insert(pengaturan)
        .values({ key: DIGEST_KEY, value: weekKey });
    }
    return { count: macet.length, sent: true };
  } catch (err) {
    console.warn(`[pinjam-macet] Gagal kirim digest:`, err);
    return { count: macet.length, sent: false };
  }
}
