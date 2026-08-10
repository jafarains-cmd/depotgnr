"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { kategoriBiaya, type TipeKategori } from "@/db/schema/kategori-biaya";
import { requireRole } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

const TIPE_VALID: TipeKategori[] = ["cogs", "operasional", "sparepart"];

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isTipeValid(t: string): t is TipeKategori {
  return (TIPE_VALID as readonly string[]).includes(t);
}

export async function tambahKategoriBiayaAction(args: {
  nama: string;
  tipe: string;
  umurHariDefault?: number | null;
  hargaEstimasi?: number | null;
  urutan?: number;
}): Promise<{ ok: true; id: number } | { error: string }> {
  try {
    const session = await requireRole(["admin"]);
    const nama = args.nama.trim();
    if (nama.length < 2) return { error: "Nama minimal 2 karakter" };
    if (nama.length > 60) return { error: "Nama maksimal 60 karakter" };
    if (!isTipeValid(args.tipe)) return { error: "Tipe tidak valid" };

    const slug = slugify(nama);
    if (!slug) return { error: "Nama harus mengandung huruf/angka" };

    // Cek unique slug
    const existing = await db.query.kategoriBiaya.findFirst({
      where: eq(kategoriBiaya.slug, slug),
    });
    if (existing) return { error: `Kategori "${nama}" sudah ada` };

    const umur =
      args.tipe === "sparepart"
        ? Math.max(1, Math.floor(args.umurHariDefault ?? 180))
        : null;
    const harga = args.hargaEstimasi
      ? Math.max(0, Math.floor(args.hargaEstimasi))
      : null;

    const now = new Date();
    const [inserted] = await db
      .insert(kategoriBiaya)
      .values({
        slug,
        nama,
        tipe: args.tipe,
        umurHariDefault: umur,
        hargaEstimasi: harga,
        urutan: args.urutan ?? 100,
        aktif: true,
        isSystem: false,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: kategoriBiaya.id });

    if (!inserted) return { error: "Gagal simpan" };

    await logAudit({
      actorUserId: session.user.id,
      action: "kategori-biaya.tambah",
      entity: "kategori_biaya",
      entityId: inserted.id,
      after: { slug, nama, tipe: args.tipe, umurHariDefault: umur, hargaEstimasi: harga },
    });

    revalidatePath("/admin/kategori-biaya");
    return { ok: true, id: inserted.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: `Gagal: ${msg}` };
  }
}

export async function updateKategoriBiayaAction(args: {
  id: number;
  nama: string;
  umurHariDefault?: number | null;
  hargaEstimasi?: number | null;
  urutan?: number;
}): Promise<{ ok: true } | { error: string }> {
  try {
    const session = await requireRole(["admin"]);
    const nama = args.nama.trim();
    if (nama.length < 2) return { error: "Nama minimal 2 karakter" };

    const row = await db.query.kategoriBiaya.findFirst({
      where: eq(kategoriBiaya.id, args.id),
    });
    if (!row) return { error: "Kategori tidak ditemukan" };

    const umur =
      row.tipe === "sparepart"
        ? Math.max(1, Math.floor(args.umurHariDefault ?? row.umurHariDefault ?? 180))
        : null;
    const harga = args.hargaEstimasi
      ? Math.max(0, Math.floor(args.hargaEstimasi))
      : row.hargaEstimasi;

    const before = {
      nama: row.nama,
      umurHariDefault: row.umurHariDefault,
      hargaEstimasi: row.hargaEstimasi,
      urutan: row.urutan,
    };

    await db
      .update(kategoriBiaya)
      .set({
        nama,
        umurHariDefault: umur,
        hargaEstimasi: harga,
        urutan: args.urutan ?? row.urutan,
        updatedAt: new Date(),
      })
      .where(eq(kategoriBiaya.id, args.id));

    await logAudit({
      actorUserId: session.user.id,
      action: "kategori-biaya.update",
      entity: "kategori_biaya",
      entityId: args.id,
      before,
      after: { nama, umurHariDefault: umur, hargaEstimasi: harga, urutan: args.urutan },
    });

    revalidatePath("/admin/kategori-biaya");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: `Gagal: ${msg}` };
  }
}

export async function toggleAktifKategoriBiayaAction(
  id: number,
): Promise<{ ok: true; aktif: boolean } | { error: string }> {
  try {
    const session = await requireRole(["admin"]);
    const row = await db.query.kategoriBiaya.findFirst({
      where: eq(kategoriBiaya.id, id),
    });
    if (!row) return { error: "Kategori tidak ditemukan" };

    const aktifBaru = !row.aktif;
    await db
      .update(kategoriBiaya)
      .set({ aktif: aktifBaru, updatedAt: new Date() })
      .where(eq(kategoriBiaya.id, id));

    await logAudit({
      actorUserId: session.user.id,
      action: aktifBaru ? "kategori-biaya.aktifkan" : "kategori-biaya.nonaktifkan",
      entity: "kategori_biaya",
      entityId: id,
      before: { aktif: row.aktif },
      after: { aktif: aktifBaru },
    });

    revalidatePath("/admin/kategori-biaya");
    return { ok: true, aktif: aktifBaru };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: `Gagal: ${msg}` };
  }
}

export async function hapusKategoriBiayaAction(
  id: number,
): Promise<{ ok: true } | { error: string }> {
  try {
    const session = await requireRole(["admin"]);
    const row = await db.query.kategoriBiaya.findFirst({
      where: eq(kategoriBiaya.id, id),
    });
    if (!row) return { error: "Kategori tidak ditemukan" };
    if (row.isSystem) {
      return {
        error: "Kategori system tidak bisa dihapus. Nonaktifkan saja kalau tidak dipakai.",
      };
    }

    await db.delete(kategoriBiaya).where(eq(kategoriBiaya.id, id));

    await logAudit({
      actorUserId: session.user.id,
      action: "kategori-biaya.hapus",
      entity: "kategori_biaya",
      entityId: id,
      before: { slug: row.slug, nama: row.nama, tipe: row.tipe },
    });

    revalidatePath("/admin/kategori-biaya");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: `Gagal: ${msg}` };
  }
}
