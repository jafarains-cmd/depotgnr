"use server";

import { and, eq, like, or, sql } from "drizzle-orm";
import { requireRole } from "@/lib/permissions";
import { db } from "@/db";
import { pelanggan, galonDipinjam } from "@/db/schema/pelanggan";

/**
 * Cari pelanggan by nama atau telp untuk autocomplete di modal
 * tambah galon dipinjam. Limit 15.
 */
export async function searchPelangganForGalon(
  query: string,
): Promise<
  Array<{
    id: number;
    nama: string;
    telp: string | null;
    saldoGalon: number;
  }>
> {
  await requireRole(["admin", "kasir"]);
  const q = query.trim();
  if (q.length < 2) return [];

  const pat = `%${q}%`;
  const rows = await db
    .select({
      id: pelanggan.id,
      nama: pelanggan.nama,
      telp: pelanggan.telp,
      saldoGalon: sql<number>`coalesce((select sum(${galonDipinjam.jumlah}) from ${galonDipinjam} where ${galonDipinjam.pelangganId} = ${pelanggan.id}), 0)`,
    })
    .from(pelanggan)
    .where(or(like(pelanggan.nama, pat), like(pelanggan.telp, pat)))
    .limit(15);

  return rows.map((r) => ({
    id: r.id,
    nama: r.nama,
    telp: r.telp,
    saldoGalon: Number(r.saldoGalon ?? 0),
  }));
}

/**
 * Ambil saldo galon dipinjam current untuk pelanggan+produk tertentu.
 * Return 0 kalau belum ada record.
 */
export async function getSaldoGalonPelangganProduk(
  pelangganId: number,
  produkId: number,
): Promise<number> {
  await requireRole(["admin", "kasir"]);
  const row = await db.query.galonDipinjam.findFirst({
    where: and(
      eq(galonDipinjam.pelangganId, pelangganId),
      eq(galonDipinjam.produkId, produkId),
    ),
  });
  return row?.jumlah ?? 0;
}
