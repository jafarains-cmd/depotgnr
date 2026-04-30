import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orderHeader, lokasiKurir } from "@/db/schema/order";
import { requireRole } from "@/lib/permissions";

export async function POST(req: Request) {
  const session = await requireRole(["admin", "kasir", "kurir"]);

  const body = await req.json();
  const { orderId, lat, lng, accuracy, speed, heading } = body as {
    orderId: number;
    lat: number;
    lng: number;
    accuracy?: number;
    speed?: number;
    heading?: number;
  };

  if (!orderId || typeof lat !== "number" || typeof lng !== "number") {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const o = await db.query.orderHeader.findFirst({ where: eq(orderHeader.id, orderId) });
  if (!o) return NextResponse.json({ error: "order not found" }, { status: 404 });

  const role = (session.user as { role?: string }).role;
  if (o.kurirUserId !== session.user.id && role !== "admin" && role !== "kasir") {
    return NextResponse.json({ error: "not your order" }, { status: 403 });
  }
  if (!["dijemput", "diisi", "diantar", "diproses"].includes(o.status)) {
    return NextResponse.json({ error: `status ${o.status} tidak track` }, { status: 400 });
  }

  await db.insert(lokasiKurir).values({
    orderId,
    kurirUserId: session.user.id,
    lat,
    lng,
    accuracy,
    speed,
    heading,
  });

  return NextResponse.json({ ok: true });
}
