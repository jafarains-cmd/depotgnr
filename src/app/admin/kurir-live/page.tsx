import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { orderHeader, lokasiKurir } from "@/db/schema/order";
import { pelanggan } from "@/db/schema/pelanggan";
import { user } from "@/db/schema/auth";
import { requireRole } from "@/lib/permissions";
import { PageHeader } from "@/components/AppShell";
import { KurirLiveClient, type KurirLiveRow } from "./KurirLiveClient";

export const dynamic = "force-dynamic";

const ACTIVE_STATUSES: Array<"dijemput" | "diisi" | "diantar" | "diproses"> = [
  "dijemput",
  "diisi",
  "diantar",
  "diproses",
];

export default async function KurirLivePage() {
  await requireRole(["admin"]);

  // Order aktif dengan kurir sudah di-assign
  const orders = await db
    .select({
      orderId: orderHeader.id,
      nomorOrder: orderHeader.nomorOrder,
      status: orderHeader.status,
      alamatAntar: orderHeader.alamatAntar,
      kurirUserId: orderHeader.kurirUserId,
      pelangganId: orderHeader.pelangganId,
      kurirName: user.name,
      pelangganNama: pelanggan.nama,
      pelangganTelp: pelanggan.telp,
      pelangganLat: pelanggan.koordinatLat,
      pelangganLng: pelanggan.koordinatLng,
    })
    .from(orderHeader)
    .leftJoin(user, eq(orderHeader.kurirUserId, user.id))
    .leftJoin(pelanggan, eq(orderHeader.pelangganId, pelanggan.id))
    .where(
      and(
        inArray(orderHeader.status, ACTIVE_STATUSES),
        isNotNull(orderHeader.kurirUserId),
      ),
    );

  // Ambil last-known location per order (kalau ada)
  const orderIds = orders.map((o) => o.orderId);
  const latestLocs = orderIds.length
    ? await db
        .select({
          orderId: lokasiKurir.orderId,
          lat: lokasiKurir.lat,
          lng: lokasiKurir.lng,
          accuracy: lokasiKurir.accuracy,
          speed: lokasiKurir.speed,
          createdAt: lokasiKurir.createdAt,
          rn: sql<number>`row_number() over (partition by ${lokasiKurir.orderId} order by ${lokasiKurir.createdAt} desc)`,
        })
        .from(lokasiKurir)
        .where(inArray(lokasiKurir.orderId, orderIds))
        .orderBy(desc(lokasiKurir.createdAt))
    : [];
  const locByOrder = new Map<number, (typeof latestLocs)[number]>();
  for (const l of latestLocs) {
    if (l.rn === 1) locByOrder.set(l.orderId, l);
  }

  const rows: KurirLiveRow[] = orders.map((o) => {
    const loc = locByOrder.get(o.orderId);
    return {
      orderId: o.orderId,
      nomorOrder: o.nomorOrder,
      status: o.status,
      kurirName: o.kurirName ?? "—",
      pelangganNama: o.pelangganNama ?? null,
      pelangganTelp: o.pelangganTelp ?? null,
      alamatAntar: o.alamatAntar ?? null,
      tujuanLat: o.pelangganLat ?? null,
      tujuanLng: o.pelangganLng ?? null,
      kurirLat: loc?.lat ?? null,
      kurirLng: loc?.lng ?? null,
      accuracy: loc?.accuracy ?? null,
      lastSyncMs: loc?.createdAt.getTime() ?? null,
    };
  });

  // Urut: yang punya lokasi live dulu, terus by nomor order
  rows.sort((a, b) => {
    if ((a.lastSyncMs ?? 0) !== (b.lastSyncMs ?? 0)) {
      return (b.lastSyncMs ?? 0) - (a.lastSyncMs ?? 0);
    }
    return a.nomorOrder.localeCompare(b.nomorOrder);
  });

  const tracking = rows.filter((r) => r.kurirLat !== null).length;
  const totalActive = rows.length;
  const nowMs = Date.now();

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title="Kurir Live"
        description={`${tracking} dari ${totalActive} order aktif sedang tracking. Auto-refresh tiap 15 detik.`}
      />
      <KurirLiveClient rows={rows} initialNowMs={nowMs} />
    </div>
  );
}
