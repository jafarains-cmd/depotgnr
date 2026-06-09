import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { pelanggan, mutasiLoyalti } from "@/db/schema/pelanggan";
import { orderHeader, orderItem } from "@/db/schema/order";
import { user as userTable } from "@/db/schema/auth";
import { pengaturan } from "@/db/schema/pengaturan";
import { sendWhatsApp } from "./whatsapp";
import { sendTelegram } from "./telegram";
import { sendPushToUser } from "./push";
import { bestEffort } from "./best-effort";

// Re-export untuk backward-compat (banyak file import dari sini)
export {
  RATE_ANTAR_PER_GALON,
  RATE_DEPOT_PER_GALON,
  REFERRAL_BONUS,
} from "./constants";
import {
  RATE_ANTAR_PER_GALON as DEFAULT_RATE_ANTAR,
  RATE_DEPOT_PER_GALON as DEFAULT_RATE_DEPOT,
  REFERRAL_BONUS as DEFAULT_REFERRAL_BONUS,
} from "./constants";

/**
 * Baca konfigurasi loyalty dari pengaturan (kalau ada), fallback ke konstanta default.
 * Dipakai oleh earnLoyalty / earnFromOrderIfEligible / claimReferralBonus.
 */
export async function getLoyaltyConfig(): Promise<{
  ratePerGalonAntar: number;
  ratePerGalonDepot: number;
  referralBonus: number;
  welcomeBonus: number;
}> {
  const rows = await db.query.pengaturan.findMany();
  const map = new Map(rows.map((r) => [r.key, r.value ?? ""]));

  const parse = (key: string, fallback: number) => {
    const v = Number(map.get(key));
    return Number.isFinite(v) && v >= 0 ? v : fallback;
  };

  return {
    ratePerGalonAntar: parse("loyaltiPerGalonAntar", DEFAULT_RATE_ANTAR),
    ratePerGalonDepot: parse("loyaltiPerGalonDepot", DEFAULT_RATE_DEPOT),
    referralBonus: parse("nilaiReferralBonus", DEFAULT_REFERRAL_BONUS),
    welcomeBonus: parse("welcomeBonus", 5000),
  };
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // skip ambiguous I/O/0/1

export async function generateUniqueKodeReferral(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    let code = "";
    for (let j = 0; j < 6; j++) {
      code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    }
    const exists = await db.query.pelanggan.findFirst({
      where: eq(pelanggan.kodeReferral, code),
    });
    if (!exists) return code;
  }
  // Fallback timestamp-based
  return `R${Date.now().toString(36).toUpperCase().slice(-5)}`;
}

export async function ensureKodeReferral(pelangganId: number): Promise<string> {
  const p = await db.query.pelanggan.findFirst({ where: eq(pelanggan.id, pelangganId) });
  if (!p) throw new Error("Pelanggan tidak ditemukan");
  if (p.kodeReferral) return p.kodeReferral;
  const kode = await generateUniqueKodeReferral();
  await db.update(pelanggan).set({ kodeReferral: kode }).where(eq(pelanggan.id, pelangganId));
  return kode;
}

type EarnArgs = {
  pelangganId: number;
  jumlahGalon: number;
  rate: number; // 250 atau 500
  refOrderId?: number;
  refTransaksiId?: number;
  deskripsi: string;
};

export async function earnLoyalty(args: EarnArgs): Promise<number> {
  const total = args.jumlahGalon * args.rate;
  if (total <= 0) return 0;

  // Idempotency: skip kalau sudah ada earn untuk order/transaksi yang sama
  if (args.refOrderId) {
    const existing = await db.query.mutasiLoyalti.findFirst({
      where: and(
        eq(mutasiLoyalti.refOrderId, args.refOrderId),
        eq(mutasiLoyalti.tipe, "earn"),
      ),
    });
    if (existing) return 0;
  }
  if (args.refTransaksiId && !args.refOrderId) {
    const existing = await db.query.mutasiLoyalti.findFirst({
      where: and(
        eq(mutasiLoyalti.refTransaksiId, args.refTransaksiId),
        eq(mutasiLoyalti.tipe, "earn"),
      ),
    });
    if (existing) return 0;
  }

  await db.transaction((tx) => {
    tx.insert(mutasiLoyalti)
      .values({
        pelangganId: args.pelangganId,
        jumlah: total,
        tipe: "earn",
        refOrderId: args.refOrderId,
        refTransaksiId: args.refTransaksiId,
        deskripsi: args.deskripsi,
      })
      .run();
    tx.update(pelanggan)
      .set({
        saldoLoyalti: sql`${pelanggan.saldoLoyalti} + ${total}`,
        stampGalon: sql`${pelanggan.stampGalon} + ${args.jumlahGalon}`,
      })
      .where(eq(pelanggan.id, args.pelangganId))
      .run();
  });

  // Cek apakah ada reward stamp baru
  await bestEffort(
    "checkAndClaimStampReward",
    checkAndClaimStampReward(args.pelangganId, args.refOrderId, args.refTransaksiId),
  );

  return total;
}

async function getCfg(key: string): Promise<string> {
  const row = await db.query.pengaturan.findFirst({ where: eq(pengaturan.key, key) });
  return row?.value ?? "";
}

async function checkAndClaimStampReward(
  pelangganId: number,
  refOrderId?: number,
  refTransaksiId?: number,
): Promise<void> {
  const aktifRaw = await getCfg("aktifkanStampGalon");
  if (aktifRaw && aktifRaw !== "1" && aktifRaw.toLowerCase() !== "true") return;
  // Default aktif kalau belum diset

  const thresholdRaw = await getCfg("stampThresholdGalon");
  const threshold = Math.max(1, Number(thresholdRaw) || 10);

  const nilaiRaw = await getCfg("nilaiGalonGratis");
  const nilai = Math.max(0, Number(nilaiRaw) || 5_000);
  if (nilai === 0) return;

  const p = await db.query.pelanggan.findFirst({ where: eq(pelanggan.id, pelangganId) });
  if (!p) return;

  const earnedTotal = Math.floor(p.stampGalon / threshold);
  const newRewards = earnedTotal - p.stampClaimedCount;
  if (newRewards <= 0) return;

  const totalReward = newRewards * nilai;

  await db.transaction((tx) => {
    tx.insert(mutasiLoyalti)
      .values({
        pelangganId,
        jumlah: totalReward,
        tipe: "stamp_reward",
        refOrderId,
        refTransaksiId,
        deskripsi: `Bonus ${newRewards} galon gratis (sudah ${p.stampGalon} galon)`,
      })
      .run();
    tx.update(pelanggan)
      .set({
        saldoLoyalti: sql`${pelanggan.saldoLoyalti} + ${totalReward}`,
        stampClaimedCount: earnedTotal,
      })
      .where(eq(pelanggan.id, pelangganId))
      .run();
  });

  // Notif pelanggan
  bestEffort(
    "notifStampReward",
    notifStampReward(pelangganId, newRewards, totalReward, p.stampGalon),
  );
}

async function notifStampReward(
  pelangganId: number,
  newRewards: number,
  totalReward: number,
  stampTotal: number,
): Promise<void> {
  const p = await db.query.pelanggan.findFirst({ where: eq(pelanggan.id, pelangganId) });
  if (!p) return;
  const text =
    `🎉 Selamat! Anda dapat *${newRewards} galon gratis* (Rp ${totalReward.toLocaleString("id-ID")} saldo loyalty).\n` +
    `Total galon Anda sudah ${stampTotal}. Saldo bisa dipakai di order/transaksi berikutnya.`;
  if (p.telp) await sendWhatsApp(p.telp, text).catch(() => {});
  if (p.userId) {
    const u = await db.query.user.findFirst({ where: eq(userTable.id, p.userId) });
    if (u?.telegramChatId) await sendTelegram(u.telegramChatId, text).catch(() => {});
    sendPushToUser(p.userId, {
      title: "🎉 Galon Gratis!",
      body: `Anda dapat ${newRewards} galon gratis (Rp ${totalReward.toLocaleString("id-ID")} saldo).`,
      url: "/pelanggan/loyalty",
      tag: "stamp-reward",
    }).catch(() => {});
  }
}

/**
 * Earn loyalty dari order langsung (tanpa via transaksi).
 * Dipanggil saat order selesai + statusBayar lunas & belum punya transaksiId.
 * Idempoten — kalau sudah pernah earn untuk order ini, akan skip.
 */
export async function earnFromOrderIfEligible(orderId: number): Promise<void> {
  const o = await db.query.orderHeader.findFirst({ where: eq(orderHeader.id, orderId) });
  if (!o || o.status !== "selesai" || o.statusBayar !== "lunas") return;
  if (o.transaksiId) return; // earn sudah dilakukan via transaksi
  if (!o.pelangganId) return;

  const items = await db.query.orderItem.findMany({
    where: eq(orderItem.orderId, orderId),
  });
  const totalGalon = items.reduce((s, it) => s + it.qty, 0);
  if (totalGalon === 0) return;

  // Earn hanya untuk galon yang dibayar PAKAI UANG (bukan loyalty).
  // Hitung jumlah galon "ditebus" loyalti berdasarkan harga rata-rata per galon.
  const subtotal = items.reduce((s, it) => s + it.hargaEstimasi * it.qty, 0);
  const hargaPerGalon = totalGalon > 0 ? Math.round(subtotal / totalGalon) : 0;
  const galonRedeem =
    hargaPerGalon > 0 && o.loyaltiDipakai > 0
      ? Math.floor(o.loyaltiDipakai / hargaPerGalon)
      : 0;
  const galonForEarn = Math.max(0, totalGalon - galonRedeem);
  if (galonForEarn === 0) {
    // Full loyalty → tidak ada earn baru. Tetap klaim referral kalau eligible.
    await claimReferralBonusIfFirstOrder(o.pelangganId, orderId);
    return;
  }

  const cfg = await getLoyaltyConfig();
  // POS depot (pelanggan datang langsung) ditandai dengan alamat
  // '(diambil di depot)' → pakai rate DEPOT, bukan ANTAR
  const isPickupDepot = o.alamatAntar === "(diambil di depot)";
  const rate = isPickupDepot ? cfg.ratePerGalonDepot : cfg.ratePerGalonAntar;
  const desc = galonRedeem > 0
    ? `Earn dari order ${o.nomorOrder} (${galonForEarn} galon bayar tunai × Rp ${rate.toLocaleString("id-ID")}, ${galonRedeem} galon pakai loyalty)`
    : `Earn dari order ${o.nomorOrder} (${galonForEarn} galon × Rp ${rate.toLocaleString("id-ID")})`;
  await earnLoyalty({
    pelangganId: o.pelangganId,
    jumlahGalon: galonForEarn,
    rate,
    refOrderId: orderId,
    deskripsi: desc,
  });
  await claimReferralBonusIfFirstOrder(o.pelangganId, orderId);
}

export async function redeemLoyalty(args: {
  pelangganId: number;
  jumlah: number;
  refOrderId?: number;
  refTransaksiId?: number;
  deskripsi: string;
}): Promise<{ ok: true; redeemed: number } | { ok: false; error: string }> {
  if (args.jumlah <= 0) return { ok: false, error: "Jumlah redeem harus > 0" };

  // Atomic check-and-deduct: UPDATE conditional WHERE saldo cukup.
  // Dengan begitu 2 concurrent redeem tidak bisa overdraft.
  const result = db.transaction((tx) => {
    const updated = tx
      .update(pelanggan)
      .set({ saldoLoyalti: sql`${pelanggan.saldoLoyalti} - ${args.jumlah}` })
      .where(
        and(
          eq(pelanggan.id, args.pelangganId),
          gte(pelanggan.saldoLoyalti, args.jumlah),
        ),
      )
      .run();

    if (updated.changes === 0) {
      // Cek alasan gagal (pelanggan tidak ada vs saldo tidak cukup)
      const p = tx.select().from(pelanggan).where(eq(pelanggan.id, args.pelangganId)).get();
      return p
        ? { ok: false as const, error: `Saldo tidak cukup (saldo: ${p.saldoLoyalti})` }
        : { ok: false as const, error: "Pelanggan tidak ditemukan" };
    }

    tx.insert(mutasiLoyalti)
      .values({
        pelangganId: args.pelangganId,
        jumlah: -args.jumlah,
        tipe: "redeem",
        refOrderId: args.refOrderId,
        refTransaksiId: args.refTransaksiId,
        deskripsi: args.deskripsi,
      })
      .run();

    return { ok: true as const, redeemed: args.jumlah };
  });

  return result;
}

/**
 * Klaim referral bonus saat pelanggan referee menyelesaikan order/transaksi pertamanya yang lunas.
 * - Referee dapat REFERRAL_BONUS (sebagai welcome reward)
 * - Referrer dapat REFERRAL_BONUS (commission)
 *
 * Idempoten via DB: cek mutasi_loyalti existence (tipe=referral_in untuk pelangganId).
 * Pakai DB sebagai single source of truth — tidak ada race window.
 * (firstOrderRewardClaimed flag legacy masih ada di schema tapi tidak di-rely-on lagi.)
 */
export async function claimReferralBonusIfFirstOrder(
  pelangganId: number,
  refOrderId?: number,
  refTransaksiId?: number,
): Promise<void> {
  const p = await db.query.pelanggan.findFirst({ where: eq(pelanggan.id, pelangganId) });
  if (!p) return;

  // Welcome bonus: dipindah dari registrasi ke order pertama supaya hanya
  // pelanggan aktif yang dapat. Idempoten via deskripsi LIKE check.
  const { giveWelcomeBonus } = await import("./pelanggan");
  await giveWelcomeBonus(pelangganId).catch(() => {});

  // Bonus referral staff: kalau pelanggan diajak kasir/admin/kurir, catat bonus
  // pending. Idempoten via cek pelangganId di bonus_referral_staff.
  const { claimStaffReferralBonusIfFirstOrder } = await import("./referral-staff");
  await claimStaffReferralBonusIfFirstOrder(pelangganId, refTransaksiId).catch(() => {});

  // Bonus referral antar-pelanggan (logic lama)
  if (!p.referredBy) return;

  // Cek apakah sudah pernah di-claim (idempotency via DB).
  // Index `mutasi_loyalti(pelanggan_id, …)` cover query ini.
  const existingClaim = await db.query.mutasiLoyalti.findFirst({
    where: and(
      eq(mutasiLoyalti.pelangganId, pelangganId),
      eq(mutasiLoyalti.tipe, "referral_in"),
    ),
  });
  if (existingClaim) return;

  // Baca bonus dari pengaturan
  const { referralBonus: bonusAmount } = await getLoyaltyConfig();

  await db.transaction((tx) => {
    // Referee bonus
    tx.insert(mutasiLoyalti)
      .values({
        pelangganId,
        jumlah: bonusAmount,
        tipe: "referral_in",
        refOrderId,
        refTransaksiId,
        deskripsi: "Bonus pendaftaran via kode referral",
      })
      .run();
    tx.update(pelanggan)
      .set({
        saldoLoyalti: sql`${pelanggan.saldoLoyalti} + ${bonusAmount}`,
        firstOrderRewardClaimed: true, // legacy, tetap di-set untuk backward-compat
      })
      .where(eq(pelanggan.id, pelangganId))
      .run();

    // Referrer bonus
    tx.insert(mutasiLoyalti)
      .values({
        pelangganId: p.referredBy!,
        jumlah: bonusAmount,
        tipe: "referral_bonus",
        refOrderId,
        refTransaksiId,
        deskripsi: `Bonus karena pelanggan baru #${pelangganId} order pertama`,
      })
      .run();
    tx.update(pelanggan)
      .set({ saldoLoyalti: sql`${pelanggan.saldoLoyalti} + ${bonusAmount}` })
      .where(eq(pelanggan.id, p.referredBy!))
      .run();
  });
}

/**
 * Reverse semua mutasi loyalty terkait 1 order — dipanggil saat order dibatalkan
 * setelah loyalty sudah pernah di-earn. Bukan delete (audit trail tetap utuh):
 * insert mutasi `adjust` dengan jumlah negatif sebesar net total, dan decrement
 * saldoLoyalti pelanggan + stampGalon.
 *
 * Idempoten: kalau sudah ada mutasi `adjust` dengan refOrderId yang sama, skip.
 */
export async function reverseLoyaltyForOrder(orderId: number): Promise<void> {
  // Idempotency check
  const existingReverse = await db.query.mutasiLoyalti.findFirst({
    where: and(
      eq(mutasiLoyalti.refOrderId, orderId),
      eq(mutasiLoyalti.tipe, "adjust"),
    ),
  });
  if (existingReverse) return;

  // Ambil semua mutasi (earn / stamp_reward / referral_in / referral_bonus)
  // yang punya refOrderId = orderId. Group by pelangganId.
  const mutasi = await db.query.mutasiLoyalti.findMany({
    where: eq(mutasiLoyalti.refOrderId, orderId),
  });
  if (mutasi.length === 0) return;

  // Hitung galon pada order (untuk decrement stampGalon)
  const items = await db.query.orderItem.findMany({
    where: eq(orderItem.orderId, orderId),
  });
  const totalGalon = items.reduce((s, it) => s + it.qty, 0);

  // Group jumlah per pelanggan (referral mengenai 2 pelanggan: referee + referrer)
  const byPelanggan = new Map<number, number>();
  for (const m of mutasi) {
    if (m.tipe === "adjust") continue; // jangan reverse mutasi adjust lain
    byPelanggan.set(m.pelangganId, (byPelanggan.get(m.pelangganId) ?? 0) + m.jumlah);
  }
  if (byPelanggan.size === 0) return;

  await db.transaction((tx) => {
    for (const [pelangganId, totalJumlah] of byPelanggan) {
      if (totalJumlah <= 0) continue; // hanya reverse net positif
      tx.insert(mutasiLoyalti)
        .values({
          pelangganId,
          jumlah: -totalJumlah,
          tipe: "adjust",
          refOrderId: orderId,
          deskripsi: `Pembatalan order #${orderId} — reverse loyalty`,
        })
        .run();
      tx.update(pelanggan)
        .set({
          saldoLoyalti: sql`max(0, ${pelanggan.saldoLoyalti} - ${totalJumlah})`,
        })
        .where(eq(pelanggan.id, pelangganId))
        .run();
    }
    // Decrement stampGalon pada pelanggan order
    if (totalGalon > 0) {
      // Ambil pelangganId order
      const orderRow = tx
        .select({ pelangganId: orderHeader.pelangganId })
        .from(orderHeader)
        .where(eq(orderHeader.id, orderId))
        .get();
      if (orderRow?.pelangganId) {
        tx.update(pelanggan)
          .set({
            stampGalon: sql`max(0, ${pelanggan.stampGalon} - ${totalGalon})`,
          })
          .where(eq(pelanggan.id, orderRow.pelangganId))
          .run();
      }
    }
  });
}

/**
 * Reverse semua mutasi loyalty terkait 1 transaksi (versi transaksi dari
 * reverseLoyaltyForOrder). Sama logikanya — insert mutasi `adjust` negatif,
 * decrement saldo dengan `max(0, …)` supaya tidak minus.
 */
export async function reverseLoyaltyForTransaksi(transaksiId: number): Promise<void> {
  // Idempotency
  const existingReverse = await db.query.mutasiLoyalti.findFirst({
    where: and(
      eq(mutasiLoyalti.refTransaksiId, transaksiId),
      eq(mutasiLoyalti.tipe, "adjust"),
    ),
  });
  if (existingReverse) return;

  const mutasi = await db.query.mutasiLoyalti.findMany({
    where: eq(mutasiLoyalti.refTransaksiId, transaksiId),
  });
  if (mutasi.length === 0) return;

  const byPelanggan = new Map<number, number>();
  for (const m of mutasi) {
    if (m.tipe === "adjust") continue;
    byPelanggan.set(m.pelangganId, (byPelanggan.get(m.pelangganId) ?? 0) + m.jumlah);
  }
  if (byPelanggan.size === 0) return;

  await db.transaction((tx) => {
    for (const [pelangganId, totalJumlah] of byPelanggan) {
      if (totalJumlah <= 0) continue;
      tx.insert(mutasiLoyalti)
        .values({
          pelangganId,
          jumlah: -totalJumlah,
          tipe: "adjust",
          refTransaksiId: transaksiId,
          deskripsi: `Pembatalan transaksi #${transaksiId} — reverse loyalty`,
        })
        .run();
      tx.update(pelanggan)
        .set({
          saldoLoyalti: sql`max(0, ${pelanggan.saldoLoyalti} - ${totalJumlah})`,
        })
        .where(eq(pelanggan.id, pelangganId))
        .run();
    }
  });
}

/**
 * Resolve kode referral ke pelanggan id. Case-insensitive.
 */
export async function findPelangganByKode(kode: string): Promise<number | null> {
  const code = kode.trim().toUpperCase();
  if (!code) return null;
  const p = await db.query.pelanggan.findFirst({
    where: eq(pelanggan.kodeReferral, code),
  });
  return p?.id ?? null;
}
