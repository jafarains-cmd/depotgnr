import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { orderHeader, lokasiKurir } from "@/db/schema/order";
import { pelanggan as pelangganTable } from "@/db/schema/pelanggan";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { orderId: idStr } = await params;
  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  const orderId = Number(idStr);
  if (!Number.isFinite(orderId)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  const o = await db.query.orderHeader.findFirst({ where: eq(orderHeader.id, orderId) });
  if (!o) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!o.trackingToken || o.trackingToken !== token) {
    return NextResponse.json({ error: "invalid token" }, { status: 403 });
  }

  const pel = o.pelangganId
    ? await db.query.pelanggan.findFirst({ where: eq(pelangganTable.id, o.pelangganId) })
    : null;

  const latest = await db
    .select()
    .from(lokasiKurir)
    .where(eq(lokasiKurir.orderId, orderId))
    .orderBy(desc(lokasiKurir.createdAt))
    .limit(1);

  return NextResponse.json({
    ok: true,
    order: {
      nomorOrder: o.nomorOrder,
      status: o.status,
      alamatAntar: o.alamatAntar,
    },
    tujuan:
      pel?.koordinatLat && pel?.koordinatLng
        ? { lat: pel.koordinatLat, lng: pel.koordinatLng, nama: pel.nama }
        : null,
    kurir: latest[0]
      ? {
          lat: latest[0].lat,
          lng: latest[0].lng,
          accuracy: latest[0].accuracy,
          speed: latest[0].speed,
          heading: latest[0].heading,
          updatedAt: latest[0].createdAt.toISOString(),
        }
      : null,
  });
}
