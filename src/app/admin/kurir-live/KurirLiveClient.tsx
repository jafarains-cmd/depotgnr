"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bike, Navigation, MapPin, Phone, Clock } from "lucide-react";
import { KurirLiveMapLoader } from "./KurirLiveMapLoader";

const REFRESH_INTERVAL_MS = 15_000;

export type KurirLiveRow = {
  orderId: number;
  nomorOrder: string;
  status: string;
  kurirName: string;
  pelangganNama: string | null;
  pelangganTelp: string | null;
  alamatAntar: string | null;
  tujuanLat: number | null;
  tujuanLng: number | null;
  kurirLat: number | null;
  kurirLng: number | null;
  accuracy: number | null;
  lastSyncMs: number | null;
};

function haversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a[0] * Math.PI) / 180) *
      Math.cos((b[0] * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function relativeTime(diffMs: number): string {
  const s = Math.round(diffMs / 1000);
  if (s < 10) return "baru saja";
  if (s < 60) return `${s} detik lalu`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} menit lalu`;
  const h = Math.round(m / 60);
  return `${h} jam lalu`;
}

export function KurirLiveClient({
  rows,
  initialNowMs,
}: {
  rows: KurirLiveRow[];
  initialNowMs: number;
}) {
  const router = useRouter();
  const [nowMs, setNowMs] = useState(initialNowMs);
  const [selectedOrder, setSelectedOrder] = useState<number | null>(null);

  // Auto-refresh RSC + update relative time
  useEffect(() => {
    const clockId = setInterval(() => setNowMs(Date.now()), 1000);
    const refreshId = setInterval(() => router.refresh(), REFRESH_INTERVAL_MS);
    return () => {
      clearInterval(clockId);
      clearInterval(refreshId);
    };
  }, [router]);

  if (rows.length === 0) {
    return (
      <div className="bg-surface border border-line rounded-2xl p-8 text-center">
        <Bike size={40} className="mx-auto text-[color:var(--muted)] mb-3" />
        <div className="font-bold">Tidak ada order aktif</div>
        <p className="text-sm text-[color:var(--muted)] mt-1">
          Belum ada kurir yang di-assign untuk order pending/proses/antar.
        </p>
      </div>
    );
  }

  const withLocation = rows.filter((r) => r.kurirLat !== null && r.kurirLng !== null);

  return (
    <div className="grid lg:grid-cols-[380px_1fr] gap-4 h-[calc(100vh-200px)] min-h-[500px]">
      <div className="bg-surface border border-line rounded-2xl overflow-hidden flex flex-col">
        <div className="p-3 border-b border-line text-xs font-extrabold tracking-widest text-[color:var(--muted)] uppercase">
          Order Aktif ({rows.length})
        </div>
        <div className="overflow-y-auto flex-1">
          {rows.map((r) => {
            const isTracking = r.kurirLat !== null;
            const lastSyncDiff = r.lastSyncMs !== null ? nowMs - r.lastSyncMs : null;
            const stale = lastSyncDiff !== null && lastSyncDiff > 120_000; // >2 menit
            const distanceKm =
              r.kurirLat !== null &&
              r.kurirLng !== null &&
              r.tujuanLat !== null &&
              r.tujuanLng !== null
                ? haversineKm([r.kurirLat, r.kurirLng], [r.tujuanLat, r.tujuanLng])
                : null;
            const isSelected = selectedOrder === r.orderId;
            return (
              <button
                key={r.orderId}
                onClick={() => setSelectedOrder(r.orderId)}
                className={`w-full text-left p-3 border-b border-line block hover:bg-[color:var(--surface2)] transition ${
                  isSelected ? "bg-brand-soft" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-bold text-sm truncate">{r.kurirName}</div>
                  <span
                    className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                      isTracking
                        ? stale
                          ? "bg-amber-100 text-amber-800"
                          : "bg-emerald-100 text-emerald-800"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {isTracking ? (stale ? "STALE" : "LIVE") : "BELUM"}
                  </span>
                </div>
                <div className="text-xs text-[color:var(--muted)] truncate">
                  #{r.nomorOrder} · {r.status}
                </div>
                {r.pelangganNama && (
                  <div className="text-xs mt-1 truncate">
                    → {r.pelangganNama}
                    {r.pelangganTelp && (
                      <span className="text-[color:var(--muted)]"> · {r.pelangganTelp}</span>
                    )}
                  </div>
                )}
                {r.alamatAntar && (
                  <div className="text-[11px] text-[color:var(--muted)] mt-0.5 inline-flex items-start gap-1">
                    <MapPin size={11} className="mt-0.5 flex-shrink-0" />
                    <span className="line-clamp-2">{r.alamatAntar}</span>
                  </div>
                )}
                {isTracking && lastSyncDiff !== null && (
                  <div className="flex items-center justify-between mt-1.5 text-[11px]">
                    <span className="inline-flex items-center gap-1 text-[color:var(--muted)]">
                      <Clock size={11} /> {relativeTime(lastSyncDiff)}
                    </span>
                    {distanceKm !== null && (
                      <span className="font-bold text-brand">
                        {distanceKm < 1
                          ? `${Math.round(distanceKm * 1000)} m`
                          : `${distanceKm.toFixed(1)} km`}
                      </span>
                    )}
                  </div>
                )}
                <div className="flex gap-2 mt-2">
                  <Link
                    href={`/kasir/order/${r.orderId}`}
                    className="text-[11px] text-brand hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Buka order →
                  </Link>
                  {r.pelangganTelp && (
                    <a
                      href={`https://wa.me/62${r.pelangganTelp.replace(/^0/, "")}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-emerald-600 hover:underline inline-flex items-center gap-0.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Phone size={10} /> WA
                    </a>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-surface border border-line rounded-2xl overflow-hidden">
        {withLocation.length > 0 ? (
          <KurirLiveMapLoader rows={withLocation} focusOrderId={selectedOrder} />
        ) : (
          <div className="h-full grid place-items-center text-center p-8">
            <div>
              <Navigation size={40} className="mx-auto text-[color:var(--muted)] mb-3" />
              <div className="font-bold">Belum ada tracking aktif</div>
              <p className="text-sm text-[color:var(--muted)] mt-1 max-w-sm">
                Kurir sudah di-assign tapi belum tap "Mulai Tracking" di HP mereka. Peta akan
                muncul setelah kurir aktifkan.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
