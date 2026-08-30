import { NextResponse } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { fcmToken } from "@/db/schema/auth";
import { requireSession } from "@/lib/permissions";

const registerSchema = z.object({
  token: z.string().min(20),
  platform: z.enum(["android", "ios"]).default("android"),
  userAgent: z.string().optional(),
});

/**
 * POST /api/push/fcm-register
 * Body: { token, platform?, userAgent? }
 *
 * Register (atau update lastSeenAt kalau sudah ada) FCM token untuk user
 * login. Kalau token yang sama sudah terdaftar untuk user lain (misal HP
 * dipinjam user lain terus login), pindahkan ownership ke user sekarang.
 */
export async function POST(req: Request) {
  const session = await requireSession();
  const body = await req.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }
  const { token, platform, userAgent } = parsed.data;
  const userId = session.user.id;
  const now = new Date();

  const existing = await db.query.fcmToken.findFirst({
    where: eq(fcmToken.token, token),
  });

  if (existing) {
    // Token sama, user beda → transfer ownership
    if (existing.userId !== userId) {
      await db
        .update(fcmToken)
        .set({ userId, platform, userAgent, lastSeenAt: now })
        .where(eq(fcmToken.token, token));
    } else {
      // Same user → just refresh lastSeenAt + userAgent
      await db
        .update(fcmToken)
        .set({ lastSeenAt: now, userAgent })
        .where(eq(fcmToken.token, token));
    }
  } else {
    await db.insert(fcmToken).values({
      userId,
      token,
      platform,
      userAgent,
    });
  }

  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/push/fcm-register?token=xxx
 * Hapus token (dipanggil saat user logout / uninstall app).
 */
export async function DELETE(req: Request) {
  const session = await requireSession();
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "missing token" }, { status: 400 });

  await db
    .delete(fcmToken)
    .where(and(eq(fcmToken.token, token), eq(fcmToken.userId, session.user.id)));

  return NextResponse.json({ ok: true });
}

/**
 * Cegah token bocor ke user lain yang login setelahnya di HP yang sama.
 * Client harus panggil endpoint ini saat DIFFERENT user login di HP yang
 * sudah punya token — supaya token dipindah, bukan ditumpuk.
 * (Implementasi actual via UPSERT logic di POST — endpoint ini opsional.)
 */
export async function PATCH(req: Request) {
  const session = await requireSession();
  const body = await req.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }
  // Hapus token milik user lain kalau ada (safety)
  await db
    .delete(fcmToken)
    .where(and(eq(fcmToken.token, parsed.data.token), ne(fcmToken.userId, session.user.id)));
  return NextResponse.json({ ok: true });
}
