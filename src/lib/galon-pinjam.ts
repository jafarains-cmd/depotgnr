import { and, eq, sql, desc } from "drizzle-orm";
import { db } from "@/db";
import { galonDipinjam, mutasiGalonPinjam, pelanggan } from "@/db/schema/pelanggan";
import { produk } from "@/db/schema/produk";

/**
 * Catat satu mutasi galon dipinjam + upsert saldo.
 * Convention:
 *   perubahan > 0 → galon depot keluar (pelanggan pinjam tambahan)
 *   perubahan < 0 → galon depot masuk (pelanggan kembalikan)
 * Saldo minimum 0 (clamped — tidak boleh negatif).
 */
export async function catatMutasiGalonPinjam(args: {
  pelangganId: number;
  produkId: number;
  perubahan: number;
  tipe: "pinjam" | "kembali" | "adjust" | "reverse";
  alasan?: string;
  refTransaksiId?: number | null;
  refOrderId?: number | null;
  galonSerial?: string | null;
  userId: string;
}): Promise<{ ok: true; jumlahBaru: number } | { error: string }> {
  if (!Number.isInteger(args.perubahan) || args.perubahan === 0) {
    return { error: "Perubahan harus integer bukan nol" };
  }

  const existing = await db.query.galonDipinjam.findFirst({
    where: and(
      eq(galonDipinjam.pelangganId, args.pelangganId),
      eq(galonDipinjam.produkId, args.produkId),
    ),
  });

  const current = existing?.jumlah ?? 0;
  const jumlahBaru = Math.max(0, current + args.perubahan);

  await db.transaction((tx) => {
    if (existing) {
      tx.update(galonDipinjam)
        .set({ jumlah: jumlahBaru, updatedAt: new Date() })
        .where(eq(galonDipinjam.id, existing.id))
        .run();
    } else {
      tx.insert(galonDipinjam)
        .values({
          pelangganId: args.pelangganId,
          produkId: args.produkId,
          jumlah: jumlahBaru,
        })
        .run();
    }
    tx.insert(mutasiGalonPinjam)
      .values({
        pelangganId: args.pelangganId,
        produkId: args.produkId,
        perubahan: args.perubahan,
        tipe: args.tipe,
        alasan: args.alasan?.trim() || null,
        refTransaksiId: args.refTransaksiId ?? null,
        refOrderId: args.refOrderId ?? null,
        galonSerial: args.galonSerial ?? null,
        userId: args.userId,
      })
      .run();
  });

  return { ok: true, jumlahBaru };
}

/**
 * Apply delta from a transaction/order (pinjam = qty yang keluar ke pelanggan,
 * kembali = qty yang masuk dari pelanggan). Bisa keduanya 0 (skip).
 *
 * Catat 2 baris mutasi terpisah supaya audit trail jelas (bukan net).
 */
export async function applyGalonPinjamFromTransaksi(args: {
  pelangganId: number;
  produkId: number;
  pinjam: number; // qty galon depot diberikan ke pelanggan
  kembali: number; // qty galon depot diterima dari pelanggan
  refTransaksiId?: number | null;
  refOrderId?: number | null;
  userId: string;
}): Promise<void> {
  if (args.pinjam > 0) {
    await catatMutasiGalonPinjam({
      pelangganId: args.pelangganId,
      produkId: args.produkId,
      perubahan: args.pinjam,
      tipe: "pinjam",
      refTransaksiId: args.refTransaksiId,
      refOrderId: args.refOrderId,
      userId: args.userId,
    });
  }
  if (args.kembali > 0) {
    await catatMutasiGalonPinjam({
      pelangganId: args.pelangganId,
      produkId: args.produkId,
      perubahan: -args.kembali,
      tipe: "kembali",
      refTransaksiId: args.refTransaksiId,
      refOrderId: args.refOrderId,
      userId: args.userId,
    });
  }
}

/**
 * Get saldo current pelanggan per produk + grand total.
 */
export async function getSaldoGalonPinjam(pelangganId: number): Promise<{
  total: number;
  perProduk: Array<{ produkId: number; namaProduk: string; jumlah: number }>;
}> {
  const rows = await db
    .select({
      produkId: galonDipinjam.produkId,
      jumlah: galonDipinjam.jumlah,
      namaProduk: produk.nama,
    })
    .from(galonDipinjam)
    .leftJoin(produk, eq(galonDipinjam.produkId, produk.id))
    .where(eq(galonDipinjam.pelangganId, pelangganId));

  const perProduk = rows
    .filter((r) => r.jumlah > 0)
    .map((r) => ({
      produkId: r.produkId,
      namaProduk: r.namaProduk ?? `#${r.produkId}`,
      jumlah: r.jumlah,
    }));
  const total = perProduk.reduce((s, r) => s + r.jumlah, 0);
  return { total, perProduk };
}

/**
 * History mutasi galon pinjam untuk 1 pelanggan, terbaru dulu.
 */
export async function getHistoryGalonPinjam(pelangganId: number, limit = 50) {
  return db
    .select({
      id: mutasiGalonPinjam.id,
      produkId: mutasiGalonPinjam.produkId,
      perubahan: mutasiGalonPinjam.perubahan,
      tipe: mutasiGalonPinjam.tipe,
      alasan: mutasiGalonPinjam.alasan,
      refTransaksiId: mutasiGalonPinjam.refTransaksiId,
      refOrderId: mutasiGalonPinjam.refOrderId,
      galonSerial: mutasiGalonPinjam.galonSerial,
      userId: mutasiGalonPinjam.userId,
      createdAt: mutasiGalonPinjam.createdAt,
      namaProduk: produk.nama,
    })
    .from(mutasiGalonPinjam)
    .leftJoin(produk, eq(mutasiGalonPinjam.produkId, produk.id))
    .where(eq(mutasiGalonPinjam.pelangganId, pelangganId))
    .orderBy(desc(mutasiGalonPinjam.createdAt))
    .limit(limit);
}

/**
 * List pelanggan dengan saldo > 0, sortir desc by total. Untuk halaman admin.
 */
export async function summaryGalonPinjam(): Promise<
  Array<{
    pelangganId: number;
    nama: string;
    telp: string | null;
    totalGalon: number;
    lastUpdate: Date;
  }>
> {
  const rows = await db
    .select({
      pelangganId: galonDipinjam.pelangganId,
      nama: pelanggan.nama,
      telp: pelanggan.telp,
      totalGalon: sql<number>`sum(${galonDipinjam.jumlah})`,
      lastUpdate: sql<Date>`max(${galonDipinjam.updatedAt})`,
    })
    .from(galonDipinjam)
    .leftJoin(pelanggan, eq(galonDipinjam.pelangganId, pelanggan.id))
    .groupBy(galonDipinjam.pelangganId, pelanggan.nama, pelanggan.telp)
    .having(sql`sum(${galonDipinjam.jumlah}) > 0`)
    .orderBy(desc(sql`sum(${galonDipinjam.jumlah})`));

  return rows.map((r) => ({
    pelangganId: r.pelangganId,
    nama: r.nama ?? "?",
    telp: r.telp,
    totalGalon: Number(r.totalGalon ?? 0),
    lastUpdate: r.lastUpdate instanceof Date ? r.lastUpdate : new Date(r.lastUpdate),
  }));
}

/**
 * Reverse semua mutasi galon pinjam terkait 1 transaksi. Idempoten via cek
 * tipe="reverse" yang sudah ada untuk refTransaksiId itu.
 */
export async function reverseGalonPinjamForTransaksi(
  transaksiId: number,
  userId: string,
): Promise<void> {
  await reverseGalonPinjamBy("refTransaksiId", transaksiId, userId);
}

export async function reverseGalonPinjamForOrder(
  orderId: number,
  userId: string,
): Promise<void> {
  await reverseGalonPinjamBy("refOrderId", orderId, userId);
}

async function reverseGalonPinjamBy(
  field: "refTransaksiId" | "refOrderId",
  refId: number,
  userId: string,
): Promise<void> {
  const col = field === "refTransaksiId"
    ? mutasiGalonPinjam.refTransaksiId
    : mutasiGalonPinjam.refOrderId;

  // Idempotency: kalau sudah ada reverse, skip
  const alreadyReversed = await db.query.mutasiGalonPinjam.findFirst({
    where: and(eq(col, refId), eq(mutasiGalonPinjam.tipe, "reverse")),
  });
  if (alreadyReversed) return;

  const mutasi = await db.query.mutasiGalonPinjam.findMany({
    where: eq(col, refId),
  });
  if (mutasi.length === 0) return;

  for (const m of mutasi) {
    if (m.tipe === "reverse") continue;
    await catatMutasiGalonPinjam({
      pelangganId: m.pelangganId,
      produkId: m.produkId,
      perubahan: -m.perubahan,
      tipe: "reverse",
      alasan: `Reverse mutasi #${m.id} (${m.tipe})`,
      refTransaksiId: field === "refTransaksiId" ? refId : null,
      refOrderId: field === "refOrderId" ? refId : null,
      userId,
    });
  }
}
