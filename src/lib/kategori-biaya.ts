import { asc, eq, and } from "drizzle-orm";
import { db } from "@/db";
import { kategoriBiaya, type TipeKategori } from "@/db/schema/kategori-biaya";

export type KategoriOption = {
  id: number;
  slug: string;
  nama: string;
  tipe: TipeKategori;
  umurHariDefault: number | null;
  hargaEstimasi: number | null;
};

/**
 * Ambil kategori aktif untuk dropdown, optional filter by tipe.
 */
export async function getKategoriAktif(
  tipe?: TipeKategori,
): Promise<KategoriOption[]> {
  const conds = [eq(kategoriBiaya.aktif, true)];
  if (tipe) conds.push(eq(kategoriBiaya.tipe, tipe));

  const rows = await db
    .select({
      id: kategoriBiaya.id,
      slug: kategoriBiaya.slug,
      nama: kategoriBiaya.nama,
      tipe: kategoriBiaya.tipe,
      umurHariDefault: kategoriBiaya.umurHariDefault,
      hargaEstimasi: kategoriBiaya.hargaEstimasi,
    })
    .from(kategoriBiaya)
    .where(and(...conds))
    .orderBy(asc(kategoriBiaya.urutan), asc(kategoriBiaya.nama));

  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    nama: r.nama,
    tipe: r.tipe as TipeKategori,
    umurHariDefault: r.umurHariDefault,
    hargaEstimasi: r.hargaEstimasi,
  }));
}

/**
 * Cari kategori by slug (untuk backward-compat / fallback dari data lama).
 */
export async function getKategoriBySlug(slug: string): Promise<KategoriOption | null> {
  const row = await db.query.kategoriBiaya.findFirst({
    where: eq(kategoriBiaya.slug, slug),
  });
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    nama: row.nama,
    tipe: row.tipe as TipeKategori,
    umurHariDefault: row.umurHariDefault,
    hargaEstimasi: row.hargaEstimasi,
  };
}

/**
 * Cari kategori by id.
 */
export async function getKategoriById(id: number): Promise<KategoriOption | null> {
  const row = await db.query.kategoriBiaya.findFirst({
    where: eq(kategoriBiaya.id, id),
  });
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    nama: row.nama,
    tipe: row.tipe as TipeKategori,
    umurHariDefault: row.umurHariDefault,
    hargaEstimasi: row.hargaEstimasi,
  };
}
