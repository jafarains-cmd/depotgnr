import { and, count, eq, gt, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { pelanggan } from "@/db/schema/pelanggan";
import { pengaturan } from "@/db/schema/pengaturan";
import { orderHeader } from "@/db/schema/order";
import { getSaldoGalonPinjam } from "./galon-pinjam";

const DEFAULT_LIMIT_GALON = 5;
const INAKTIF_HARI = 30;

/**
 * Baca default limit galon dari pengaturan (fallback 5 kalau belum di-set).
 */
export async function getDefaultLimitGalon(): Promise<number> {
  const row = await db.query.pengaturan.findFirst({
    where: eq(pengaturan.key, "default_limit_galon_langganan"),
  });
  const n = Number(row?.value ?? "");
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_LIMIT_GALON;
}

/**
 * Baca syarat langganan yang ditampilkan di form onboarding.
 * Kalau belum di-set, kasih copy default yang masuk akal.
 */
export async function getSyaratLangganan(): Promise<string> {
  const row = await db.query.pengaturan.findFirst({
    where: eq(pengaturan.key, "syarat_langganan"),
  });
  return (
    row?.value?.trim() ||
    `Dengan mendaftar langganan, Anda mendapat pinjaman galon depot untuk kemudahan order rutin.

Syarat:
• Foto KTP asli (buram/tidak jelas akan ditolak)
• Alamat lengkap sudah diisi di profil
• Bersedia mengembalikan galon depot saat berhenti berlangganan
• Batas pinjaman default 5 galon (bisa dinaikkan sesuai kebutuhan)

Verifikasi biasanya <24 jam. Setelah disetujui, order pertama sudah bisa pakai galon depot.`
  );
}

/**
 * Effective limit galon untuk 1 pelanggan (per-akun override → global default).
 */
export async function getEffectiveLimitGalon(pelangganId: number): Promise<number> {
  const p = await db.query.pelanggan.findFirst({
    where: eq(pelanggan.id, pelangganId),
  });
  if (!p) return await getDefaultLimitGalon();
  if (p.limitGalon !== null && p.limitGalon !== undefined && p.limitGalon > 0) {
    return p.limitGalon;
  }
  return await getDefaultLimitGalon();
}

/**
 * Cek apakah pelanggan langganan bisa pinjam sejumlah `tambah` galon lagi
 * tanpa lewat limit. Kalau bukan langganan / belum verified, tidak boleh
 * pinjam sama sekali.
 */
export async function cekLimitGalon(
  pelangganId: number,
  tambah: number,
): Promise<
  | { ok: true; sisa: number; saldo: number; limit: number }
  | { ok: false; reason: string; saldo: number; limit: number }
> {
  const p = await db.query.pelanggan.findFirst({
    where: eq(pelanggan.id, pelangganId),
  });
  if (!p) return { ok: false, reason: "Pelanggan tidak ditemukan", saldo: 0, limit: 0 };
  if (p.tipe !== "langganan") {
    return {
      ok: false,
      reason: "Pelanggan bukan tipe langganan (belum verifikasi KTP)",
      saldo: 0,
      limit: 0,
    };
  }
  const { total: saldo } = await getSaldoGalonPinjam(pelangganId);
  const limit = await getEffectiveLimitGalon(pelangganId);
  const setelah = saldo + tambah;
  if (setelah > limit) {
    return {
      ok: false,
      reason: `Melebihi limit galon (${saldo} + ${tambah} > ${limit}). Naikkan limit dulu di profil pelanggan.`,
      saldo,
      limit,
    };
  }
  return { ok: true, sisa: limit - setelah, saldo, limit };
}

/**
 * List pelanggan langganan yang pegang galon dipinjam > 0 DAN tidak transaksi
 * >= INAKTIF_HARI hari. Untuk alert di kasir/admin.
 */
export type LanggananInaktif = {
  pelangganId: number;
  nama: string;
  telp: string | null;
  galonDipegang: number;
  lastOrderAt: Date | null;
  hariTidakOrder: number;
};

export async function getLanggananInaktif(): Promise<LanggananInaktif[]> {
  const cutoffMs = Date.now() - INAKTIF_HARI * 24 * 60 * 60 * 1000;

  // Ambil semua pelanggan tipe langganan
  const rows = await db
    .select({
      id: pelanggan.id,
      nama: pelanggan.nama,
      telp: pelanggan.telp,
    })
    .from(pelanggan)
    .where(eq(pelanggan.tipe, "langganan"));

  const result: LanggananInaktif[] = [];
  for (const r of rows) {
    // Cek saldo galon
    const { total: galonDipegang } = await getSaldoGalonPinjam(r.id);
    if (galonDipegang <= 0) continue;

    // Cari last order (created_at)
    const lastOrder = await db
      .select({ createdAt: orderHeader.createdAt })
      .from(orderHeader)
      .where(eq(orderHeader.pelangganId, r.id))
      .orderBy(sql`${orderHeader.createdAt} desc`)
      .limit(1);
    const lastAt = lastOrder[0]?.createdAt ?? null;
    const lastMs = lastAt?.getTime() ?? 0;
    if (lastMs > cutoffMs) continue; // masih aktif <30 hari, skip
    const hari = lastAt ? Math.floor((Date.now() - lastMs) / (24 * 60 * 60 * 1000)) : 999;

    result.push({
      pelangganId: r.id,
      nama: r.nama,
      telp: r.telp,
      galonDipegang,
      lastOrderAt: lastAt,
      hariTidakOrder: hari,
    });
  }
  // Sort: pegang galon terbanyak dulu
  result.sort((a, b) => b.galonDipegang - a.galonDipegang);
  return result;
}

/**
 * Count untuk badge notifikasi di sidebar admin/kasir.
 */
export async function countLanggananInaktif(): Promise<number> {
  const list = await getLanggananInaktif();
  return list.length;
}

/**
 * Count pelanggan yang menunggu verifikasi admin (langganan_pending).
 */
export async function countLanggananPending(): Promise<number> {
  const [r] = await db
    .select({ n: count() })
    .from(pelanggan)
    .where(eq(pelanggan.tipe, "langganan_pending"));
  return Number(r?.n ?? 0);
}
