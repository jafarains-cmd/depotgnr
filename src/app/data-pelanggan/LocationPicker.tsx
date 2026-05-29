"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { MapPin, X } from "lucide-react";
import { LocationSearchBox } from "./LocationSearchBox";

// Wrapper switcher Google ↔ OSM — load client-only
const MapPicker = dynamic(() => import("./MapPicker").then((m) => m.MapPicker), {
  ssr: false,
  loading: () => <div className="h-full flex items-center justify-center">Memuat peta...</div>,
});

export function LocationPicker({
  lat,
  lng,
  onChange,
}: {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number, lng: number) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="flex items-center gap-2">
        <span className="text-xs text-[color:var(--muted)] flex-1">
          {lat !== null && lng !== null
            ? `${lat.toFixed(6)}, ${lng.toFixed(6)}`
            : "Belum diset"}
        </span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="px-2 py-1 text-xs bg-brand-50 text-brand-700 border border-brand-200 rounded inline-flex items-center gap-1 hover:bg-brand-100"
        >
          <MapPin size={12} /> Pilih di Peta
        </button>
        {(lat !== null || lng !== null) && (
          <button
            type="button"
            onClick={() => onChange(NaN, NaN)}
            className="text-xs text-red-600 hover:underline"
            title="Hapus koordinat"
          >
            Hapus
          </button>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-xl w-full max-w-3xl h-[80vh] flex flex-col overflow-hidden">
            <div className="flex justify-between items-center p-3 border-b border-line">
              <div>
                <div className="font-semibold">Pilih Lokasi Pelanggan</div>
                <div className="text-xs text-[color:var(--muted)]">
                  Cari alamat di bawah atau klik langsung di peta.
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="text-[color:var(--muted)] hover:text-ink">
                <X size={20} />
              </button>
            </div>
            <div className="p-3 border-b border-line">
              <LocationSearchBox
                onPick={(la, ln) => {
                  onChange(la, ln);
                }}
              />
            </div>
            <div className="flex-1 min-h-0">
              <MapPicker
                lat={lat}
                lng={lng}
                onPick={(la, ln) => {
                  onChange(la, ln);
                }}
              />
            </div>
            <div className="p-3 border-t border-line flex justify-end">
              <button
                onClick={() => setOpen(false)}
                className="px-4 py-2 bg-brand-600 text-white rounded-md text-sm"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
