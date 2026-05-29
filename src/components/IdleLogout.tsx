"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

const ACTIVITY_EVENTS = ["mousemove", "click", "keydown", "touchstart", "scroll"];

/**
 * Auto-logout staff (admin/kasir/kurir) setelah idle X menit tanpa aktivitas.
 * Cegah kasir lupa logout di komputer warnet/depot.
 *
 * Tidak dipasang untuk pelanggan (mereka boleh stay logged in).
 *
 * Default 30 menit, configurable lewat prop dari pengaturan.
 */
export function IdleLogout({ timeoutMenit = 30 }: { timeoutMenit?: number }) {
  const router = useRouter();
  const lastActivityRef = useRef<number>(Date.now());
  const [warning, setWarning] = useState(false);

  useEffect(() => {
    const timeoutMs = timeoutMenit * 60_000;
    const warningMs = Math.max(60_000, timeoutMs - 60_000); // warning 1 menit sebelumnya

    function bumpActivity() {
      lastActivityRef.current = Date.now();
      setWarning(false);
    }

    ACTIVITY_EVENTS.forEach((evt) => {
      window.addEventListener(evt, bumpActivity, { passive: true });
    });

    const interval = setInterval(async () => {
      const idleFor = Date.now() - lastActivityRef.current;
      if (idleFor >= timeoutMs) {
        // Auto-logout
        try {
          await authClient.signOut();
        } catch {
          // ignore
        }
        router.push("/login?reason=idle");
      } else if (idleFor >= warningMs) {
        setWarning(true);
      }
    }, 30_000); // cek tiap 30 detik

    return () => {
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, bumpActivity));
      clearInterval(interval);
    };
  }, [timeoutMenit, router]);

  if (!warning) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[110] bg-amber-500 text-white rounded-xl px-4 py-2.5 shadow-xl flex items-center gap-2 text-xs font-bold animate-pulse">
      ⏱ Idle terdeteksi — auto-logout dalam &lt;1 menit
    </div>
  );
}
