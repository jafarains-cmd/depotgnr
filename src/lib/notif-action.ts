"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { pelanggan as pelangganTable } from "@/db/schema/pelanggan";
import { getSession } from "./permissions";
import {
  countOrderMasuk,
  countPembayaranMenunggu,
  countKurirAktif,
  countKurirBonusPending,
  countPesananBelumTuntas,
  countKomplainBaru,
  countKomplainPelangganActive,
  countPelangganDenganGalonPinjam,
} from "./notifications";
import { countShiftStale } from "./shift";
import { notifStaleShiftsIfNeeded } from "./shift-stale-notif";
import { bestEffort } from "./best-effort";
import { countChurnRisk } from "./analytics";
import { countLanggananPending, countLanggananInaktif } from "./langganan";

export type NotifCounts = {
  orderMasuk?: number;
  pembayaran?: number;
  kurirAktif?: number;
  bonusPending?: number;
  followUp?: number;
  pesanan?: number;
  komplain?: number;
  galonPinjam?: number;
  shiftStale?: number;
  langgananPending?: number;
  langgananInaktif?: number;
};

/**
 * Server action — return semua badge counts yang relevan untuk role user
 * yang sedang login. Dipanggil polling tiap 30s dari client.
 */
export async function getNotifCountsForCurrentUser(): Promise<NotifCounts> {
  const session = await getSession();
  if (!session) return {};
  const role = session.user.role ?? "pelanggan";

  if (role === "admin") {
    const [
      orderMasuk,
      pembayaran,
      kurirAktif,
      bonusPending,
      churn,
      komplainBaru,
      galonPinjam,
      shiftStale,
      langgananPending,
      langgananInaktif,
    ] = await Promise.all([
      countOrderMasuk(),
      countPembayaranMenunggu(),
      countKurirAktif(session.user.id),
      countKurirBonusPending(),
      countChurnRisk().catch(() => ({ due: 0, overdue: 0, churn: 0 })),
      countKomplainBaru(),
      countPelangganDenganGalonPinjam(),
      countShiftStale(),
      countLanggananPending().catch(() => 0),
      countLanggananInaktif().catch(() => 0),
    ]);
    // Best-effort: kirim notif ke grup WA/Telegram untuk shift stale yang
    // belum dinotif dalam 6 jam terakhir. Dipicu lazy saat admin akses dashboard.
    if (shiftStale > 0) {
      bestEffort("notifStaleShifts", notifStaleShiftsIfNeeded().then(() => {}));
    }
    return {
      orderMasuk,
      pembayaran,
      kurirAktif,
      bonusPending,
      followUp: churn.due + churn.overdue + churn.churn,
      komplain: komplainBaru,
      galonPinjam,
      shiftStale,
      langgananPending,
      langgananInaktif,
    };
  }

  if (role === "kasir") {
    const [orderMasuk, pembayaran, kurirAktif, langgananInaktif] = await Promise.all([
      countOrderMasuk(),
      countPembayaranMenunggu(),
      countKurirAktif(session.user.id),
      countLanggananInaktif().catch(() => 0),
    ]);
    return { orderMasuk, pembayaran, kurirAktif, langgananInaktif };
  }

  if (role === "kurir") {
    const kurirAktif = await countKurirAktif(session.user.id);
    return { kurirAktif };
  }

  // pelanggan
  const pel = await db.query.pelanggan.findFirst({
    where: eq(pelangganTable.userId, session.user.id),
  });
  if (!pel) return {};
  const [pesanan, komplainActive] = await Promise.all([
    countPesananBelumTuntas(pel.id),
    countKomplainPelangganActive(pel.id),
  ]);
  return { pesanan, komplain: komplainActive };
}
