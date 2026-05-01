import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
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

  // Upsert: kalau endpoint sudah ada milik user yang sama → update, kalau milik
  // user lain → reject (mencegah hijack subscription orang lain).
  const existing = await db.query.pushSubscription.findFirst({
    where: eq(pushSubscription.endpoint, endpoint),
  });
  if (existing) {
    if (existing.userId !== session.user.id) {
      return NextResponse.json({ error: "endpoint owned by another user" }, { status: 403 });
    }
    await db
      .update(pushSubscription)
      .set({
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
  // Hanya boleh delete subscription milik sendiri.
  await db
    .delete(pushSubscription)
    .where(
      and(
        eq(pushSubscription.endpoint, endpoint),
        eq(pushSubscription.userId, session.user.id),
      ),
    );
  return NextResponse.json({ ok: true });
}
