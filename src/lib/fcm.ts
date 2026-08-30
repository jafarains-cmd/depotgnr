import { eq, inArray } from "drizzle-orm";
import { getApps, initializeApp, cert, type App } from "firebase-admin/app";
import { getMessaging, type Message } from "firebase-admin/messaging";
import { db } from "@/db";
import { fcmToken } from "@/db/schema/auth";

/**
 * Firebase Admin init — pakai service account JSON dari env var
 * FIREBASE_SERVICE_ACCOUNT_JSON (isi JSON di-serialize sebagai satu string).
 * Lazy init supaya build tidak crash kalau env tidak ada di dev.
 */
let app: App | null = null;
function getApp(): App | null {
  if (app) return app;
  const existing = getApps();
  if (existing.length > 0) {
    app = existing[0];
    return app;
  }
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    app = initializeApp({
      credential: cert(parsed),
      projectId: parsed.project_id,
    });
    return app;
  } catch {
    // JSON invalid — log-only, jangan crash server
    console.error("[fcm] FIREBASE_SERVICE_ACCOUNT_JSON invalid JSON");
    return null;
  }
}

export type FcmPayload = {
  title: string;
  body: string;
  /** URL yang di-buka saat notif di-tap (deep link). Optional. */
  url?: string;
  /** Tag untuk grouping / replace notif lama dengan key sama. */
  tag?: string;
  /** Data payload extra (dikirim ke handler client). */
  data?: Record<string, string>;
};

/**
 * Kirim FCM ke semua token yang terdaftar untuk userId.
 * Cleanup token yang invalid (UNREGISTERED / INVALID_ARGUMENT) otomatis.
 */
export async function sendFcmToUser(userId: string, payload: FcmPayload): Promise<void> {
  const initialized = getApp();
  if (!initialized) return; // FCM belum di-setup, silent skip

  const tokens = await db
    .select()
    .from(fcmToken)
    .where(eq(fcmToken.userId, userId));

  if (tokens.length === 0) return;

  const messaging = getMessaging(initialized);
  const invalidTokens: string[] = [];

  await Promise.all(
    tokens.map(async (t) => {
      const message: Message = {
        token: t.token,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: {
          ...(payload.url ? { url: payload.url } : {}),
          ...(payload.tag ? { tag: payload.tag } : {}),
          ...(payload.data ?? {}),
        },
        android: {
          priority: "high",
          notification: {
            channelId: "depot-air-default",
            tag: payload.tag,
            clickAction: "FCM_PLUGIN_ACTIVITY", // Capacitor push-notifications default
          },
        },
      };

      try {
        await messaging.send(message);
      } catch (e) {
        const code = (e as { code?: string }).code;
        // Token expired / uninstalled / invalid → hapus dari DB
        if (
          code === "messaging/registration-token-not-registered" ||
          code === "messaging/invalid-registration-token" ||
          code === "messaging/invalid-argument"
        ) {
          invalidTokens.push(t.token);
        } else {
          console.error("[fcm] send failed:", code ?? e);
        }
      }
    }),
  );

  if (invalidTokens.length > 0) {
    await db
      .delete(fcmToken)
      .where(inArray(fcmToken.token, invalidTokens))
      .catch(() => {});
  }
}

/**
 * Cek apakah FCM sudah di-configure (env var ada + valid).
 * Buat health check / debug endpoint.
 */
export function fcmReady(): boolean {
  return getApp() !== null;
}
