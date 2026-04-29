import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { pushSubscription } from "@/db/schema/auth";
import { getSession } from "@/lib/permissions";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json();
  const { endpoint, keys, userAgent } = body as {
    endpoint: string;
    keys: { p256dh: string; auth: string };
    userAgent?: string;
  };

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  // Upsert by endpoint
  const existing = await db.query.pushSubscription.findFirst({
    where: eq(pushSubscription.endpoint, endpoint),
  });
  if (existing) {
    await db
      .update(pushSubscription)
      .set({
        userId: session.user.id,
        p256dh: keys.p256dh,
        authKey: keys.auth,
        userAgent,
      })
      .where(eq(pushSubscription.endpoint, endpoint));
  } else {
    await db.insert(pushSubscription).values({
      userId: session.user.id,
      endpoint,
      p256dh: keys.p256dh,
      authKey: keys.auth,
      userAgent,
    });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json();
  const { endpoint } = body as { endpoint: string };
  if (!endpoint) return NextResponse.json({ error: "invalid" }, { status: 400 });
  await db
    .delete(pushSubscription)
    .where(eq(pushSubscription.endpoint, endpoint));
  return NextResponse.json({ ok: true });
}
