import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { orderHeader, lokasiKurir } from "@/db/schema/order";
import { pelanggan as pelangganTable } from "@/db/schema/pelanggan";
import { etaMenit } from "@/lib/eta";

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

  const kurirData = latest[0];
  const tujuanData =
    pel?.koordinatLat && pel?.koordinatLng
      ? { lat: pel.koordinatLat, lng: pel.koordinatLng, nama: pel.nama }
      : null;

  // Hitung ETA hanya saat sedang aktif diantar
  const sedangBerjalan = ["diisi", "diantar", "diproses", "dijemput"].includes(o.status);
  const eta =
    sedangBerjalan && kurirData && tujuanData
      ? etaMenit(
          { lat: kurirData.lat, lng: kurirData.lng },
          { lat: tujuanData.lat, lng: tujuanData.lng },
        )
      : null;

  return NextResponse.json({
    ok: true,
    order: {
      nomorOrder: o.nomorOrder,
      status: o.status,
      alamatAntar: o.alamatAntar,
      jadwalAntar: o.jadwalAntar?.toISOString() ?? null,
    },
    tujuan: tujuanData,
    kurir: kurirData
      ? {
          lat: kurirData.lat,
          lng: kurirData.lng,
          accuracy: kurirData.accuracy,
          speed: kurirData.speed,
          heading: kurirData.heading,
          updatedAt: kurirData.createdAt.toISOString(),
        }
      : null,
    etaMenit: eta,
  });
}
