"use client";

import { useState, useEffect, useRef } from "react";
import { Navigation, Square, AlertTriangle } from "lucide-react";

const PUSH_INTERVAL_MS = 30_000;

export function TrackingButton({
  orderId,
  status,
}: {
  orderId: number;
  status: string;
}) {
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSent, setLastSent] = useState<Date | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPosRef = useRef<GeolocationPosition | null>(null);

  // Auto-stop kalau status sudah selesai
  useEffect(() => {
    if (status === "selesai" || status === "batal") stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  function start() {
    setError(null);
    if (!("geolocation" in navigator)) {
      setError("Geolocation tidak didukung browser ini");
      return;
    }
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        lastPosRef.current = pos;
        setError(null);
      },
      (e) => {
        setError(`Gagal dapat lokasi: ${e.message}`);
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 30_000 },
    );

    // Push lokasi tiap 30s
    intervalRef.current = setInterval(pushLokasi, PUSH_INTERVAL_MS);
    pushLokasi(); // langsung push pertama
    setActive(true);
  }

  function stop() {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setActive(false);
  }

  async function pushLokasi() {
    const pos = lastPosRef.current;
    if (!pos) return;
    try {
      await fetch("/api/kurir/lokasi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          speed: pos.coords.speed,
          heading: pos.coords.heading,
        }),
      });
      setLastSent(new Date());
    } catch (e) {
      // ignore
    }
  }

  useEffect(() => {
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!["dijemput", "diisi", "diantar", "diproses"].includes(status)) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
      <div className="text-sm font-semibold inline-flex items-center gap-1.5">
        <Navigation size={16} /> Tracking Live
      </div>
      <p className="text-xs text-slate-600">
        Aktifkan supaya pelanggan bisa lihat posisi Anda di peta. Lokasi dikirim tiap 30 detik.
      </p>

      {error && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2 inline-flex items-start gap-1">
          <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {active ? (
        <div className="space-y-2">
          <div className="text-xs text-emerald-700 inline-flex items-center gap-1">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            Tracking aktif
          </div>
          {lastSent && (
            <div className="text-xs text-slate-500">
              Last sync:{" "}
              {lastSent.toLocaleTimeString("id-ID", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </div>
          )}
          <button
            onClick={stop}
            className="w-full py-2 bg-red-600 text-white rounded-md text-sm inline-flex items-center justify-center gap-1.5"
          >
            <Square size={14} /> Stop Tracking
          </button>
        </div>
      ) : (
        <button
          onClick={start}
          className="w-full py-2 bg-blue-600 text-white rounded-md text-sm inline-flex items-center justify-center gap-1.5"
        >
          <Navigation size={14} /> Mulai Tracking
        </button>
      )}
    </div>
  );
}
