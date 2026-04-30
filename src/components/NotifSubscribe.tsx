"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, X } from "lucide-react";

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}

export function NotifSubscribe() {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ok = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setSupported(ok);
    if (!ok) return;
    setPermission(Notification.permission);
    navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription();
      setSubscribed(!!sub);
    });
    // Cek dismissed flag dari localStorage
    if (localStorage.getItem("notif-dismissed") === "1") setHidden(true);
  }, []);

  async function subscribe() {
    if (!VAPID_PUBLIC) {
      alert("VAPID key belum diset di server.");
      return;
    }
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") {
        setBusy(false);
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
      });
      const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: json.keys,
          userAgent: navigator.userAgent,
        }),
      });
      setSubscribed(true);
    } finally {
      setBusy(false);
    }
  }

  async function unsubscribe() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } finally {
      setBusy(false);
    }
  }

  if (!supported || hidden) return null;
  // Sudah subscribe & belum di-dismiss → tampilkan tombol kecil disable
  if (subscribed) {
    return (
      <button
        onClick={unsubscribe}
        disabled={busy}
        className="text-xs text-[color:var(--muted)] hover:text-red-600 inline-flex items-center gap-1"
        title="Matikan notifikasi"
      >
        <BellOff size={12} /> Matikan notif
      </button>
    );
  }
  if (permission === "denied") {
    return (
      <p className="text-xs text-[color:var(--muted)]">
        Notifikasi diblokir. Aktifkan di pengaturan browser kalau mau dapat update real-time.
      </p>
    );
  }

  return (
    <div className="bg-brand-50 border border-brand-200 rounded-xl p-3 flex items-start gap-2">
      <Bell size={18} className="text-brand-700 mt-0.5 flex-shrink-0" />
      <div className="flex-1 text-sm">
        <div className="font-medium">Aktifkan notifikasi</div>
        <p className="text-xs text-[color:var(--muted)] mb-2">
          Dapat update status order, pembayaran, dan bonus loyalty langsung di HP — tanpa harus
          buka WhatsApp.
        </p>
        <div className="flex gap-2">
          <button
            onClick={subscribe}
            disabled={busy}
            className="px-3 py-1.5 bg-brand-600 text-white rounded text-xs disabled:opacity-50"
          >
            {busy ? "Memproses..." : "Aktifkan"}
          </button>
          <button
            onClick={() => {
              localStorage.setItem("notif-dismissed", "1");
              setHidden(true);
            }}
            className="px-2 py-1.5 text-[color:var(--muted)] text-xs"
          >
            Nanti saja
          </button>
        </div>
      </div>
      <button
        onClick={() => {
          localStorage.setItem("notif-dismissed", "1");
          setHidden(true);
        }}
        className="text-[color:var(--muted)]"
      >
        <X size={14} />
      </button>
    </div>
  );
}
