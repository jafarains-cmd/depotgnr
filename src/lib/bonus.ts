import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { bonusKurir } from "@/db/schema/bonus";
import { orderHeader, orderItem } from "@/db/schema/order";
import { pengaturan } from "@/db/schema/pengaturan";

const DEFAULT_RATE = 500;

export type BonusConfig = {
  aktif: boolean;
  ratePerGalon: number;
  tampilkanKeKurir: boolean;
};

export async function getBonusConfig(): Promise<BonusConfig> {
  const rows = await db.query.pengaturan.findMany();
  const map = new Map(rows.map((r) => [r.key, r.value ?? ""]));
  const aktifRaw = map.get("aktifkanBonusKurir") ?? "1";
  const rateRaw = Number(map.get("bonusKurirPerGalon"));
  const showRaw = map.get("tampilkanBonusKeKurir") ?? "1";
  return {
    aktif: aktifRaw !== "0" && aktifRaw.toLowerCase() !== "false",
    ratePerGalon: Number.isFinite(rateRaw) && rateRaw > 0 ? rateRaw : DEFAULT_RATE,
    tampilkanKeKurir: showRaw !== "0" && showRaw.toLowerCase() !== "false",
  };
}

/**
 * Catat bonus kurir untuk 1 order. Idempoten — kalau sudah pernah dicatat
 * (cek by orderId), skip. Cuma jalan kalau:
 *  - Bonus aktif di pengaturan
 *  - Order status=selesai DAN statusBayar=lunas
 *  - Order punya kurirUserId
 *  - Order punya items dengan qty > 0
 */
export async function recordKurirBonus(orderId: number): Promise<void> {
  const cfg = await getBonusConfig();
  if (!cfg.aktif) return;

  const o = await db.query.orderHeader.findFirst({
    where: eq(orderHeader.id, orderId),
  });
  if (!o) return;
  if (o.status !== "selesai" || o.statusBayar !== "lunas") return;
  if (!o.kurirUserId) return;
  // Skip POS depot (pelanggan ambil sendiri) — tidak ada antar fisik,
  // jadi tidak wajar dapat bonus kurir.
  if (o.alamatAntar === "(diambil di depot)") return;

  // Idempotency: cek by orderId
  const existing = await db.query.bonusKurir.findFirst({
    where: eq(bonusKurir.orderId, orderId),
  });
  if (existing) return;

  const items = await db.query.orderItem.findMany({
    where: eq(orderItem.orderId, orderId),
  });
  const totalGalon = items.reduce((s, it) => s + it.qty, 0);
  if (totalGalon === 0) return;

  const total = totalGalon * cfg.ratePerGalon;

  await db.insert(bonusKurir).values({
    kurirUserId: o.kurirUserId,
    orderId,
    jumlahGalon: totalGalon,
    ratePerGalon: cfg.ratePerGalon,
    total,
    status: "pending",
  });
}

/**
 * Hapus bonus kurir untuk 1 order saat order dibatalkan. Hanya menghapus
 * bonus yang masih `pending` — kalau sudah `dibayar`, biarkan utuh (audit
 * trail tidak bisa di-undo, owner sudah keluar uang).
 *
 * Returns true kalau ada yang dihapus, false kalau tidak ada / sudah dibayar.
 */
export async function reverseBonusForOrder(orderId: number): Promise<boolean> {
  const existing = await db.query.bonusKurir.findFirst({
    where: eq(bonusKurir.orderId, orderId),
  });
  if (!existing) return false;
  if (existing.status === "dibayar") return false;

  await db.delete(bonusKurir).where(eq(bonusKurir.orderId, orderId));
  return true;
}

/**
 * Summary bonus per kurir (untuk admin & kurir self-view).
 */
export async function summaryBonusKurir(kurirUserId: string): Promise<{
  hariIni: number;
  pending: number;
  totalDibayar: number;
}> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const rows = await db
    .select({
      total: bonusKurir.total,
      paidPartial: bonusKurir.paidPartial,
      status: bonusKurir.status,
      createdAt: bonusKurir.createdAt,
    })
    .from(bonusKurir)
    .where(eq(bonusKurir.kurirUserId, kurirUserId));

  let hariIni = 0;
  let pending = 0;
  let totalDibayar = 0;
  for (const r of rows) {
    if (r.createdAt >= startOfDay) hariIni += r.total;
    if (r.status === "pending") {
      // Pending effective = total - paidPartial; sisa paidPartial sudah masuk ke "dibayar"
      pending += r.total - r.paidPartial;
      totalDibayar += r.paidPartial;
    } else if (r.status === "dibayar") {
      totalDibayar += r.total;
    }
  }
  return { hariIni, pending, totalDibayar };
}

/**
 * Bayar bonus kurir dengan jumlah pas. Untuk dukung uang tunai pembulatan
 * (mis. pending Rp 80.500, bayar Rp 80.000, sisa Rp 500 tetap pending).
 *
 * Logic: baris pending diurutkan paling lama dulu. Untuk tiap baris:
 *  - effectivePending = total - paidPartial
 *  - kalau sisa bayar >= effectivePending → mark dibayar penuh
 *  - kalau sisa bayar < effectivePending → tambah ke paidPartial, status
 *    tetap pending, stop loop
 *
 * Returns count baris yang fully dibayar, totalPaid (yg benar2 dialokasi),
 * dan sisaTidakTerpakai (kalau jumlahBayar > total pending).
 */
export async function bayarBonusKurirPartial(args: {
  kurirUserId: string;
  jumlahBayar: number;
  paidBy: string;
  catatan?: string;
}): Promise<{ count: number; totalPaid: number; sisaTidakTerpakai: number }> {
  if (args.jumlahBayar <= 0) return { count: 0, totalPaid: 0, sisaTidakTerpakai: 0 };

  const pendingRows = await db
    .select({
      id: bonusKurir.id,
      total: bonusKurir.total,
      paidPartial: bonusKurir.paidPartial,
    })
    .from(bonusKurir)
    .where(
      and(
        eq(bonusKurir.kurirUserId, args.kurirUserId),
        eq(bonusKurir.status, "pending"),
      ),
    )
    .orderBy(bonusKurir.createdAt);

  if (pendingRows.length === 0) {
    return { count: 0, totalPaid: 0, sisaTidakTerpakai: args.jumlahBayar };
  }

  let sisa = args.jumlahBayar;
  let totalPaid = 0;
  let count = 0;
  const now = new Date();

  for (const row of pendingRows) {
    if (sisa <= 0) break;
    const effectivePending = row.total - row.paidPartial;
    if (effectivePending <= 0) continue;

    if (sisa >= effectivePending) {
      // Bayar penuh baris ini
      await db
        .update(bonusKurir)
        .set({
          status: "dibayar",
          paidPartial: row.total,
          paidAt: now,
          paidBy: args.paidBy,
          catatan: args.catatan,
        })
        .where(eq(bonusKurir.id, row.id));
      sisa -= effectivePending;
      totalPaid += effectivePending;
      count++;
    } else {
      // Partial: tambah ke paidPartial, status tetap pending
      await db
        .update(bonusKurir)
        .set({
          paidPartial: row.paidPartial + sisa,
          // Tetap catat paidBy + catatan terakhir + paidAt sebagai indikator
          // pernah ada sebagian dibayar
          paidBy: args.paidBy,
          catatan: args.catatan,
          paidAt: now,
        })
        .where(eq(bonusKurir.id, row.id));
      totalPaid += sisa;
      sisa = 0;
    }
  }

  return { count, totalPaid, sisaTidakTerpakai: sisa };
}

/**
 * Tandai semua bonus pending milik kurir tertentu jadi "dibayar" (full payment).
 * Shortcut untuk skenario umum.
 */
export async function bayarBonusKurir(args: {
  kurirUserId: string;
  paidBy: string;
  catatan?: string;
}): Promise<{ count: number; total: number }> {
  // Hitung total pending effective (consider paidPartial)
  const pendingRows = await db
    .select({
      id: bonusKurir.id,
      total: bonusKurir.total,
      paidPartial: bonusKurir.paidPartial,
    })
    .from(bonusKurir)
    .where(
      and(
        eq(bonusKurir.kurirUserId, args.kurirUserId),
        eq(bonusKurir.status, "pending"),
      ),
    );

  if (pendingRows.length === 0) return { count: 0, total: 0 };

  const totalAmount = pendingRows.reduce(
    (s, r) => s + (r.total - r.paidPartial),
    0,
  );

  const r = await bayarBonusKurirPartial({
    kurirUserId: args.kurirUserId,
    jumlahBayar: totalAmount,
    paidBy: args.paidBy,
    catatan: args.catatan,
  });

  return { count: r.count, total: r.totalPaid };
}
