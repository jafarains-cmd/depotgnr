"use client";

import { useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import { jarakKm } from "@/lib/eta";
import { HubungiAdmin } from "./HubungiAdmin";

/**
 * Tampilkan peringatan kalau jarak pelanggan ke depot melebihi batas.
 * Menyertakan tombol Hubungi Admin (WA + Telegram).
 *
 * Render null kalau:
 * - Lokasi depot belum diset
 * - Lokasi pelanggan belum diset
 * - maxKm <= 0 (validasi nonaktif)
 * - Jarak masih dalam batas
 */
export function DistanceWarning({
  pelangganLat,
  pelangganLng,
  depotLat,
  depotLng,
  maxKm = 10,
  kontakWA,
  kontakTelegram,
}: {
  pelangganLat: number | null;
  pelangganLng: number | null;
  depotLat: number | null;
  depotLng: number | null;
  maxKm?: number;
  kontakWA?: string | null;
  kontakTelegram?: string | null;
}) {
  const distance = useMemo(() => {
    if (
      pelangganLat === null ||
      pelangganLng === null ||
      depotLat === null ||
      depotLng === null
    ) {
      return null;
    }
    return jarakKm(depotLat, depotLng, pelangganLat, pelangganLng);
  }, [pelangganLat, pelangganLng, depotLat, depotLng]);

  if (distance === null || maxKm <= 0) return null;
  if (distance <= maxKm) return null;

  return (
    <div className="bg-rose-50 border-2 border-rose-200 rounded-2xl p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-rose-100 grid place-items-center flex-shrink-0">
          <AlertTriangle size={20} className="text-rose-700" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-extrabold text-rose-900 text-sm">
            Jarak Pengantaran Terlalu Jauh
          </div>
          <div className="text-xs text-rose-800 mt-1">
            Lokasi Anda <b>{distance.toFixed(1)} km</b> dari depot, melebihi
            batas <b>{maxKm} km</b>. Order tetap bisa dibuat, tapi kami perlu
            konfirmasi tambahan untuk biaya & ketersediaan kurir.
          </div>
          <div className="text-xs text-rose-800 mt-1 font-semibold">
            👉 Silakan hubungi admin sebelum order.
          </div>
        </div>
      </div>

      {(kontakWA || kontakTelegram) && (
        <div className="border-t border-rose-200 pt-3">
          <HubungiAdmin
            kontakWA={kontakWA}
            kontakTelegram={kontakTelegram}
            pesan={`Halo admin Depot GNR, saya pelanggan dengan lokasi ${distance.toFixed(1)} km dari depot. Mohon info biaya antar & ketersediaan kurir ke lokasi saya.`}
          />
        </div>
      )}
    </div>
  );
}
