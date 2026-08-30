import { eq } from "drizzle-orm";
import webpush from "web-push";
import { db } from "@/db";
import { pushSubscription } from "@/db/schema/auth";
import { sendFcmToUser } from "./fcm";

let configured = false;
function configure() {
  if (configured) return;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:admin@depot.local";
  if (!pub || !priv) return;
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  renotify?: boolean;
};

/**
 * Kirim push notif ke user via SEMUA channel yang tersedia:
 * - Web Push (VAPID) untuk subscription browser
 * - FCM untuk token APK Android native
 *
 * Kedua channel di-kirim paralel; kalau user punya browser + APK dua-duanya,
 * kedua device akan dapat notif. Cleanup subscription/token invalid otomatis.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  await Promise.all([
    sendWebPushToUser(userId, payload),
    sendFcmToUser(userId, {
      title: payload.title,
      body: payload.body,
      url: payload.url,
      tag: payload.tag,
    }),
  ]);
}

async function sendWebPushToUser(userId: string, payload: PushPayload): Promise<void> {
  configure();
  if (!configured) return;

  const subs = await db
    .select()
    .from(pushSubscription)
    .where(eq(pushSubscription.userId, userId));

  if (subs.length === 0) return;

  const json = JSON.stringify(payload);

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.authKey },
          },
          json,
        );
      } catch (e) {
        const err = e as { statusCode?: number };
        // 410 Gone / 404 Not Found → endpoint expired, hapus
        if (err.statusCode === 404 || err.statusCode === 410) {
          await db
            .delete(pushSubscription)
            .where(eq(pushSubscription.endpoint, s.endpoint))
            .catch(() => {});
        }
      }
    }),
  );
}
