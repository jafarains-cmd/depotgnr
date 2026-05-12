"use server";

import { revalidatePath } from "next/cache";
import { eq, sql, and } from "drizzle-orm";
import { db } from "@/db";
import {
  pelanggan,
  mutasiLoyalti,
  galonPelanggan,
  mutasiTitipan,
} from "@/db/schema/pelanggan";
import { user as userTable } from "@/db/schema/auth";
import { requireRole } from "@/lib/permissions";

export async function upsertPelanggan(formData: FormData) {
  // Admin & kasir boleh create/edit
  await requireRole(["admin", "kasir"]);
  const idRaw = formData.get("id");
  const id = idRaw ? Number(idRaw) : null;
  const latRaw = String(formData.get("koordinatLat") ?? "").trim();
  const lngRaw = String(formData.get("koordinatLng") ?? "").trim();
  const data = {
    nama: String(formData.get("nama") ?? "").trim(),
    telp: String(formData.get("telp") ?? "").trim() || null,
    alamat: String(formData.get("alamat") ?? "").trim() || null,
    tipe: (formData.get("tipe") === "langganan" ? "langganan" : "umum") as "umum" | "langganan",
    catatan: String(formData.get("catatan") ?? "").trim() || null,
    koordinatLat: latRaw ? Number(latRaw) : null,
    koordinatLng: lngRaw ? Number(lngRaw) : null,
    updatedAt: new Date(),
  };
  if (!data.nama) throw new Error("Nama wajib diisi");

  if (id) {
    await db.update(pelanggan).set(data).where(eq(pelanggan.id, id));
  } else {
    await db.insert(pelanggan).values(data);
  }
  revalidatePath("/data-pelanggan");
}

export async function deletePelanggan(id: number) {
  await requireRole(["admin"]);
  await db.delete(pelanggan).where(eq(pelanggan.id, id));
  revalidatePath("/data-pelanggan");
}

/**
 * Adjust manual saldo loyalti pelanggan (admin only).
 * Insert mutasi tipe `adjust` + update saldo (max 0 supaya tidak minus).
 */
export async function adjustLoyaltyManual(
  pelangganId: number,
  jumlah: number,
  alasan: string,
): Promise<{ ok: true } | { error: string }> {
  await requireRole(["admin"]);
  const reason = alasan.trim();
  if (reason.length < 3) return { error: "Alasan wajib diisi (min 3 karakter)" };
  if (reason.length > 500) return { error: "Alasan terlalu panjang (max 500 karakter)" };
  if (!Number.isInteger(jumlah) || jumlah === 0) {
    return { error: "Jumlah harus angka bulat selain nol" };
  }
  if (Math.abs(jumlah) > 10_000_000) {
    return { error: "Jumlah di luar batas wajar (max ±10.000.000)" };
  }

  const pel = await db.query.pelanggan.findFirst({ where: eq(pelanggan.id, pelangganId) });
  if (!pel) return { error: "Pelanggan tidak ditemukan" };

  await db.transaction((tx) => {
    tx.insert(mutasiLoyalti)
      .values({
        pelangganId,
        jumlah,
        tipe: "adjust",
        deskripsi: `Adjust manual: ${reason}`,
      })
      .run();
    if (jumlah > 0) {
      tx.update(pelanggan)
        .set({ saldoLoyalti: sql`${pelanggan.saldoLoyalti} + ${jumlah}` })
        .where(eq(pelanggan.id, pelangganId))
        .run();
    } else {
      tx.update(pelanggan)
        .set({ saldoLoyalti: sql`max(0, ${pelanggan.saldoLoyalti} + ${jumlah})` })
        .where(eq(pelanggan.id, pelangganId))
        .run();
    }
  });

  revalidatePath(`/data-pelanggan/${pelangganId}`);
  revalidatePath("/data-pelanggan");
  return { ok: true };
}

/**
 * Hubungkan record pelanggan walk-in ke akun user existing. Hanya
 * boleh kalau pelanggan saat ini userId=null DAN target user belum
 * punya pelanggan record (cegah duplikat). Admin only.
 */
export async function linkPelangganToUser(
  pelangganId: number,
  userId: string,
): Promise<{ ok: true } | { error: string }> {
  await requireRole(["admin"]);

  const pel = await db.query.pelanggan.findFirst({ where: eq(pelanggan.id, pelangganId) });
  if (!pel) return { error: "Pelanggan tidak ditemukan" };
  if (pel.userId) return { error: "Pelanggan ini sudah terhubung ke akun lain" };

  const u = await db.query.user.findFirst({ where: eq(userTable.id, userId) });
  if (!u) return { error: "User tidak ditemukan" };

  const existingForUser = await db.query.pelanggan.findFirst({
    where: eq(pelanggan.userId, userId),
  });
  if (existingForUser) {
    return {
      error: `User ${u.name} sudah punya record pelanggan (id ${existingForUser.id}). Hapus dulu salah satu untuk hindari duplikat.`,
    };
  }

  await db
    .update(pelanggan)
    .set({ userId, updatedAt: new Date() })
    .where(eq(pelanggan.id, pelangganId));

  revalidatePath(`/data-pelanggan/${pelangganId}`);
  revalidatePath("/data-pelanggan");
  revalidatePath("/admin/users");
  return { ok: true };
}

/**
 * Search user yang belum punya record pelanggan (untuk kandidat link).
 */
export async function searchUsersWithoutPelanggan(
  q: string,
): Promise<{ id: string; name: string; email: string; phoneNumber: string | null }[]> {
  await requireRole(["admin"]);
  const term = q.trim();
  if (term.length < 2) return [];

  const pat = `%${term}%`;
  const rows = await db
    .select({
      id: userTable.id,
      name: userTable.name,
      email: userTable.email,
      phoneNumber: userTable.phoneNumber,
    })
    .from(userTable)
    .leftJoin(pelanggan, eq(pelanggan.userId, userTable.id))
    .where(
      and(
        sql`${pelanggan.id} IS NULL`,
        sql`(${userTable.name} LIKE ${pat} OR ${userTable.email} LIKE ${pat} OR ${userTable.phoneNumber} LIKE ${pat} OR ${userTable.username} LIKE ${pat})`,
      ),
    )
    .limit(10);
  return rows;
}

/**
 * Hapus link userId — pelanggan kembali jadi walk-in.
 */
export async function unlinkPelangganFromUser(
  pelangganId: number,
): Promise<{ ok: true } | { error: string }> {
  await requireRole(["admin"]);
  await db
    .update(pelanggan)
    .set({ userId: null, updatedAt: new Date() })
    .where(eq(pelanggan.id, pelangganId));
  revalidatePath(`/data-pelanggan/${pelangganId}`);
  revalidatePath("/data-pelanggan");
  return { ok: true };
}

/**
 * Catat mutasi galon titipan: pelanggan titip galon ke depot (perubahan +)
 * atau ambil/dikembalikan (perubahan -). Update galon_pelanggan + insert
 * mutasi_titipan untuk audit trail.
 */
export async function catatMutasiTitipan(args: {
  pelangganId: number;
  produkId: number;
  perubahan: number; // positif=titip masuk, negatif=ambil/kembali
  alasan: string;
  catatan?: string;
}): Promise<{ ok: true; jumlahBaru: number } | { error: string }> {
  const session = await requireRole(["admin", "kasir"]);
  if (!Number.isInteger(args.perubahan) || args.perubahan === 0) {
    return { error: "Jumlah harus angka bulat selain nol" };
  }
  const alasan = args.alasan.trim();
  if (!alasan) return { error: "Alasan wajib diisi" };

  // Cek pelanggan & ambil current jumlah
  const existing = await db.query.galonPelanggan.findFirst({
    where: and(
      eq(galonPelanggan.pelangganId, args.pelangganId),
      eq(galonPelanggan.produkId, args.produkId),
    ),
  });

  const currentJumlah = existing?.jumlahDititip ?? 0;
  const jumlahBaru = Math.max(0, currentJumlah + args.perubahan);

  await db.transaction((tx) => {
    if (existing) {
      tx.update(galonPelanggan)
        .set({ jumlahDititip: jumlahBaru, updatedAt: new Date() })
        .where(eq(galonPelanggan.id, existing.id))
        .run();
    } else {
      tx.insert(galonPelanggan)
        .values({
          pelangganId: args.pelangganId,
          produkId: args.produkId,
          jumlahDititip: jumlahBaru,
        })
        .run();
    }
    tx.insert(mutasiTitipan)
      .values({
        pelangganId: args.pelangganId,
        produkId: args.produkId,
        perubahan: args.perubahan,
        alasan,
        catatan: args.catatan?.trim() || null,
        userId: session.user.id,
      })
      .run();
  });

  revalidatePath(`/data-pelanggan/${args.pelangganId}`);
  revalidatePath("/data-pelanggan");
  return { ok: true, jumlahBaru };
}
