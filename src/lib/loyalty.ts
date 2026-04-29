import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { pelanggan, mutasiLoyalti } from "@/db/schema/pelanggan";
import { orderHeader, orderItem } from "@/db/schema/order";
import { user as userTable } from "@/db/schema/auth";
import { pengaturan } from "@/db/schema/pengaturan";
import { sendWhatsApp } from "./whatsapp";
import { sendTelegram } from "./telegram";
import { sendPushToUser } from "./push";

export const RATE_ANTAR_PER_GALON = 250;
export const RATE_DEPOT_PER_GALON = 500;
export const REFERRAL_BONUS = 5_000;

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
  await checkAndClaimStampReward(args.pelangganId, args.refOrderId, args.refTransaksiId).catch(() => {});

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
  notifStampReward(pelangganId, newRewards, totalReward, p.stampGalon).catch(() => {});
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

  await earnLoyalty({
    pelangganId: o.pelangganId,
    jumlahGalon: totalGalon,
    rate: RATE_ANTAR_PER_GALON,
    refOrderId: orderId,
    deskripsi: `Earn dari order ${o.nomorOrder} (${totalGalon} galon × Rp ${RATE_ANTAR_PER_GALON.toLocaleString("id-ID")})`,
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
  const p = await db.query.pelanggan.findFirst({
    where: eq(pelanggan.id, args.pelangganId),
  });
  if (!p) return { ok: false, error: "Pelanggan tidak ditemukan" };
  if (p.saldoLoyalti < args.jumlah) {
    return { ok: false, error: `Saldo tidak cukup (saldo: ${p.saldoLoyalti})` };
  }

  await db.transaction((tx) => {
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
    tx.update(pelanggan)
      .set({ saldoLoyalti: sql`${pelanggan.saldoLoyalti} - ${args.jumlah}` })
      .where(eq(pelanggan.id, args.pelangganId))
      .run();
  });

  return { ok: true, redeemed: args.jumlah };
}

/**
 * Klaim referral bonus saat pelanggan referee menyelesaikan order/transaksi pertamanya yang lunas.
 * - Referee dapat REFERRAL_BONUS (sebagai welcome reward)
 * - Referrer dapat REFERRAL_BONUS (commission)
 * Idempoten via firstOrderRewardClaimed.
 */
export async function claimReferralBonusIfFirstOrder(
  pelangganId: number,
  refOrderId?: number,
  refTransaksiId?: number,
): Promise<void> {
  const p = await db.query.pelanggan.findFirst({ where: eq(pelanggan.id, pelangganId) });
  if (!p) return;
  if (p.firstOrderRewardClaimed) return;
  if (!p.referredBy) {
    // Tidak ada yang ngajak — tetap mark claimed agar tidak dicek terus
    await db
      .update(pelanggan)
      .set({ firstOrderRewardClaimed: true })
      .where(eq(pelanggan.id, pelangganId));
    return;
  }

  await db.transaction((tx) => {
    // Referee bonus
    tx.insert(mutasiLoyalti)
      .values({
        pelangganId,
        jumlah: REFERRAL_BONUS,
        tipe: "referral_in",
        refOrderId,
        refTransaksiId,
        deskripsi: "Bonus pendaftaran via kode referral",
      })
      .run();
    tx.update(pelanggan)
      .set({
        saldoLoyalti: sql`${pelanggan.saldoLoyalti} + ${REFERRAL_BONUS}`,
        firstOrderRewardClaimed: true,
      })
      .where(eq(pelanggan.id, pelangganId))
      .run();

    // Referrer bonus
    tx.insert(mutasiLoyalti)
      .values({
        pelangganId: p.referredBy!,
        jumlah: REFERRAL_BONUS,
        tipe: "referral_bonus",
        refOrderId,
        refTransaksiId,
        deskripsi: `Bonus karena pelanggan baru #${pelangganId} order pertama`,
      })
      .run();
    tx.update(pelanggan)
      .set({ saldoLoyalti: sql`${pelanggan.saldoLoyalti} + ${REFERRAL_BONUS}` })
      .where(eq(pelanggan.id, p.referredBy!))
      .run();
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
