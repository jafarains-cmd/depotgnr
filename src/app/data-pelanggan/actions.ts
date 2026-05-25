"use server";

import { revalidatePath } from "next/cache";
import { eq, sql, and, like, or, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  pelanggan,
  mutasiLoyalti,
  galonPelanggan,
  mutasiTitipan,
} from "@/db/schema/pelanggan";
import { transaksi } from "@/db/schema/transaksi";
import { orderHeader } from "@/db/schema/order";
import { komplain } from "@/db/schema/komplain";
import { notaGabungan } from "@/db/schema/nota-gabungan";
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

/**
 * Cari pelanggan lain (yang PUNYA akun user) sebagai tujuan merge.
 * Exclude pelanggan sumber (sourceId).
 */
export async function searchPelangganTujuanMerge(
  q: string,
  sourceId: number,
): Promise<{ id: number; nama: string; telp: string | null; userId: string | null }[]> {
  await requireRole(["admin"]);
  const term = q.trim();
  if (term.length < 2) return [];
  const pat = `%${term}%`;
  return db
    .select({
      id: pelanggan.id,
      nama: pelanggan.nama,
      telp: pelanggan.telp,
      userId: pelanggan.userId,
    })
    .from(pelanggan)
    .where(
      and(
        ne(pelanggan.id, sourceId),
        sql`${pelanggan.userId} IS NOT NULL`,
        or(like(pelanggan.nama, pat), like(pelanggan.telp, pat)),
      ),
    )
    .limit(10);
}

/**
 * Gabung (merge) pelanggan sumber ke pelanggan tujuan.
 * Pindahkan: order, transaksi, mutasi loyalty, titipan, komplain, nota gabungan.
 * Transfer saldo loyalty + stamp galon. Hapus sumber setelah selesai.
 *
 * Admin only. Tidak bisa di-undo — pastikan admin sudah confirm.
 */
export async function mergePelanggan(
  sourceId: number,
  targetId: number,
): Promise<{ ok: true; summary: string } | { error: string }> {
  await requireRole(["admin"]);
  if (sourceId === targetId) return { error: "Tidak bisa merge ke diri sendiri" };

  const source = await db.query.pelanggan.findFirst({ where: eq(pelanggan.id, sourceId) });
  const target = await db.query.pelanggan.findFirst({ where: eq(pelanggan.id, targetId) });
  if (!source) return { error: "Pelanggan sumber tidak ditemukan" };
  if (!target) return { error: "Pelanggan tujuan tidak ditemukan" };

  // Pindahkan semua referensi pelangganId dari source → target
  const moved = { order: 0, transaksi: 0, mutasi: 0, titipan: 0, komplain: 0, nota: 0 };

  // 1. Order
  const r1 = db.update(orderHeader)
    .set({ pelangganId: targetId, updatedAt: new Date() })
    .where(eq(orderHeader.pelangganId, sourceId))
    .run();
  moved.order = r1.changes;

  // 2. Transaksi
  const r2 = db.update(transaksi)
    .set({ pelangganId: targetId })
    .where(eq(transaksi.pelangganId, sourceId))
    .run();
  moved.transaksi = r2.changes;

  // 3. Mutasi loyalty
  const r3 = db.update(mutasiLoyalti)
    .set({ pelangganId: targetId })
    .where(eq(mutasiLoyalti.pelangganId, sourceId))
    .run();
  moved.mutasi = r3.changes;

  // 4. Galon titipan — merge qty ke target
  const sourceTitipan = await db
    .select()
    .from(galonPelanggan)
    .where(eq(galonPelanggan.pelangganId, sourceId));
  for (const st of sourceTitipan) {
    const existing = await db
      .select()
      .from(galonPelanggan)
      .where(
        and(
          eq(galonPelanggan.pelangganId, targetId),
          eq(galonPelanggan.produkId, st.produkId),
        ),
      );
    if (existing.length) {
      db.update(galonPelanggan)
        .set({ jumlahDititip: existing[0].jumlahDititip + st.jumlahDititip })
        .where(eq(galonPelanggan.id, existing[0].id))
        .run();
    } else {
      db.insert(galonPelanggan)
        .values({
          pelangganId: targetId,
          produkId: st.produkId,
          jumlahDititip: st.jumlahDititip,
        })
        .run();
    }
    moved.titipan++;
  }
  db.delete(galonPelanggan).where(eq(galonPelanggan.pelangganId, sourceId)).run();

  // 5. Mutasi titipan
  db.update(mutasiTitipan)
    .set({ pelangganId: targetId })
    .where(eq(mutasiTitipan.pelangganId, sourceId))
    .run();

  // 6. Komplain
  const r6 = db.update(komplain)
    .set({ pelangganId: targetId, updatedAt: new Date() })
    .where(eq(komplain.pelangganId, sourceId))
    .run();
  moved.komplain = r6.changes;

  // 7. Nota gabungan
  const r7 = db.update(notaGabungan)
    .set({ pelangganId: targetId })
    .where(eq(notaGabungan.pelangganId, sourceId))
    .run();
  moved.nota = r7.changes;

  // 8. referredBy: pelanggan lain yang referred by source → point to target
  db.update(pelanggan)
    .set({ referredBy: targetId })
    .where(eq(pelanggan.referredBy, sourceId))
    .run();

  // 9. Transfer saldo + stamp ke target
  db.update(pelanggan)
    .set({
      saldoLoyalti: sql`${pelanggan.saldoLoyalti} + ${source.saldoLoyalti}`,
      stampGalon: sql`${pelanggan.stampGalon} + ${source.stampGalon}`,
      stampClaimedCount: sql`${pelanggan.stampClaimedCount} + ${source.stampClaimedCount}`,
      updatedAt: new Date(),
    })
    .where(eq(pelanggan.id, targetId))
    .run();

  // 10. Hapus pelanggan sumber
  db.delete(pelanggan).where(eq(pelanggan.id, sourceId)).run();

  const summary = [
    moved.order && `${moved.order} order`,
    moved.transaksi && `${moved.transaksi} transaksi`,
    moved.mutasi && `${moved.mutasi} mutasi loyalty`,
    moved.titipan && `${moved.titipan} titipan galon`,
    moved.komplain && `${moved.komplain} komplain`,
    moved.nota && `${moved.nota} nota gabungan`,
    source.saldoLoyalti && `saldo +${source.saldoLoyalti.toLocaleString("id-ID")}`,
    source.stampGalon && `stamp +${source.stampGalon}`,
  ]
    .filter(Boolean)
    .join(", ");

  revalidatePath("/data-pelanggan");
  revalidatePath(`/data-pelanggan/${targetId}`);
  revalidatePath("/pembayaran");
  revalidatePath("/kasir/transaksi");

  return { ok: true, summary: summary || "Tidak ada data untuk dipindahkan" };
}
