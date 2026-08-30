"use client";

import { useState, useEffect, useRef } from "react";
import { Navigation, Square, AlertTriangle } from "lucide-react";
import { BackgroundGeolocation, type Location } from "@capgo/background-geolocation";

const PUSH_INTERVAL_MS = 30_000;

/**
 * Tracking live kurir. Pakai @capgo/background-geolocation yang cross-platform:
 * - Di APK Capacitor Android: pakai foreground service native → tetap jalan
 *   saat screen off / user pindah app (persistent notification muncul).
 * - Di browser web: plugin fallback ke navigator.geolocation.watchPosition
 *   (sama seperti implementasi lama, cocok untuk admin desktop / testing).
 *
 * Auto-stop kalau status order sudah `selesai` / `batal`.
 */
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
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastLocRef = useRef<Location | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (status === "selesai" || status === "batal") stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function start() {
    setError(null);
    try {
      await BackgroundGeolocation.start(
        {
          // Foreground service notification (Android). Kalau kedua field ini
          // di-set, plugin akan pakai background mode (jalan saat screen off).
          backgroundTitle: "Depot Air — Tracking Aktif",
          backgroundMessage: "Berbagi lokasi ke pelanggan untuk order ini.",
          requestPermissions: true,
          stale: false,
          distanceFilter: 10, // meter — update kalau bergerak >10m (hemat batre)
        },
        (loc, err) => {
          if (err) {
            setError(`Lokasi gagal: ${err.message}`);
            return;
          }
          if (loc) {
            lastLocRef.current = loc;
            setError(null);
          }
        },
      );
      startedRef.current = true;
      intervalRef.current = setInterval(pushLokasi, PUSH_INTERVAL_MS);
      pushLokasi();
      setActive(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mulai tracking");
    }
  }

  async function stop() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (startedRef.current) {
      try {
        await BackgroundGeolocation.stop();
      } catch {
        // ignore — plugin sudah berhenti / belum start
      }
      startedRef.current = false;
    }
    setActive(false);
  }

  async function pushLokasi() {
    const loc = lastLocRef.current;
    if (!loc) return;
    try {
      await fetch("/api/kurir/lokasi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          lat: loc.latitude,
          lng: loc.longitude,
          accuracy: loc.accuracy,
          speed: loc.speed,
          heading: loc.bearing, // plugin pakai 'bearing', API pakai 'heading'
        }),
      });
      setLastSent(new Date());
    } catch {
      // ignore — akan di-retry di interval berikutnya
    }
  }

  useEffect(() => {
    return () => {
      void stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!["dijemput", "diisi", "diantar", "diproses"].includes(status)) return null;

  return (
    <div className="bg-surface border border-line rounded-2xl p-4 space-y-2">
      <div className="text-sm font-semibold inline-flex items-center gap-1.5">
        <Navigation size={16} /> Tracking Live
      </div>
      <p className="text-xs text-[color:var(--muted)]">
        Aktifkan supaya pelanggan bisa lihat posisi Anda di peta. Di APK tracking
        tetap jalan saat HP di saku (notifikasi persist). Lokasi dikirim tiap 30 detik.
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
            <div className="text-xs text-[color:var(--muted)]">
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
