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
} from "./notifications";
import { countChurnRisk } from "./analytics";

export type NotifCounts = {
  orderMasuk?: number;
  pembayaran?: number;
  kurirAktif?: number;
  bonusPending?: number;
  followUp?: number;
  pesanan?: number;
  komplain?: number;
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
    const [orderMasuk, pembayaran, kurirAktif, bonusPending, churn, komplainBaru] =
      await Promise.all([
        countOrderMasuk(),
        countPembayaranMenunggu(),
        countKurirAktif(session.user.id),
        countKurirBonusPending(),
        countChurnRisk().catch(() => ({ due: 0, overdue: 0, churn: 0 })),
        countKomplainBaru(),
      ]);
    return {
      orderMasuk,
      pembayaran,
      kurirAktif,
      bonusPending,
      followUp: churn.due + churn.overdue + churn.churn,
      komplain: komplainBaru,
    };
  }

  if (role === "kasir") {
    const [orderMasuk, pembayaran, kurirAktif] = await Promise.all([
      countOrderMasuk(),
      countPembayaranMenunggu(),
      countKurirAktif(session.user.id),
    ]);
    return { orderMasuk, pembayaran, kurirAktif };
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
