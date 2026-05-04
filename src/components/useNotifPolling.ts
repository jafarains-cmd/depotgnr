"use client";

import { useEffect, useRef, useState } from "react";
import { getNotifCountsForCurrentUser, type NotifCounts } from "@/lib/notif-action";

const NOTIF_POLL_INTERVAL_MS = 30_000;

/**
 * Hook polling badge notifikasi. Initial state dari server (SSR), lalu
 * client polling tiap 30s untuk update.
 *
 * Kalau request gagal (network/session expired), state lama dipertahankan —
 * tidak overwrite ke 0 supaya user tidak lihat angka "lompat".
 */
export function useNotifPolling(initial: NotifCounts): NotifCounts {
  const [counts, setCounts] = useState<NotifCounts>(initial);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    async function tick() {
      try {
        const next = await getNotifCountsForCurrentUser();
        if (mountedRef.current) setCounts(next);
      } catch {
        // silent — biarkan state lama
      }
    }

    const id = setInterval(tick, NOTIF_POLL_INTERVAL_MS);
    return () => {
      mountedRef.current = false;
      clearInterval(id);
    };
  }, []);

  return counts;
}
