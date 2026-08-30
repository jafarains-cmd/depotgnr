"use client";

import { useEffect } from "react";

/**
 * Register FCM push notification token untuk APK Capacitor Android.
 * - Cuma jalan di Capacitor native (deteksi via window.Capacitor)
 * - Di browser web / SSR → no-op
 * - Request permission → get token → POST ke /api/push/fcm-register
 * - Listen incoming push saat foreground (Android auto-tampil kalau background)
 *
 * Dynamic import supaya package @capacitor/push-notifications tidak masuk
 * bundle web (yang tidak butuh).
 */
export function FcmRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } })
      .Capacitor;
    if (!cap?.isNativePlatform?.()) return;

    let cleanup: (() => void) | null = null;

    (async () => {
      try {
        const { PushNotifications } = await import("@capacitor/push-notifications");

        // Cek permission dulu
        let permStatus = await PushNotifications.checkPermissions();
        if (permStatus.receive === "prompt") {
          permStatus = await PushNotifications.requestPermissions();
        }
        if (permStatus.receive !== "granted") {
          return; // user tolak, skip
        }

        // Register — trigger event 'registration' dengan FCM token
        await PushNotifications.register();

        const regListener = await PushNotifications.addListener("registration", async (t) => {
          try {
            await fetch("/api/push/fcm-register", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                token: t.value,
                platform: "android",
                userAgent: navigator.userAgent,
              }),
            });
          } catch {
            // ignore — akan retry di app reopen berikutnya
          }
        });

        const errListener = await PushNotifications.addListener(
          "registrationError",
          (err) => {
            console.error("[fcm] registration error:", err);
          },
        );

        // Foreground push: sistem Android tidak auto-tampil kalau app foreground,
        // jadi kita handle sendiri (bisa via alert atau Toast). Untuk MVP,
        // sistem notif OS akan handle background. Foreground kita silent —
        // event akan reach service worker kalau nanti di-wire.
        const recvListener = await PushNotifications.addListener(
          "pushNotificationReceived",
          () => {
            // no-op MVP — bisa extend dengan toast in-app kalau perlu
          },
        );

        // Handle notification tap (background app di-tap)
        const actionListener = await PushNotifications.addListener(
          "pushNotificationActionPerformed",
          (action) => {
            const url = action.notification.data?.url;
            if (typeof url === "string" && url) {
              window.location.href = url;
            }
          },
        );

        cleanup = () => {
          regListener.remove();
          errListener.remove();
          recvListener.remove();
          actionListener.remove();
        };
      } catch (e) {
        console.error("[fcm] setup failed:", e);
      }
    })();

    return () => {
      cleanup?.();
    };
  }, []);

  return null;
}
