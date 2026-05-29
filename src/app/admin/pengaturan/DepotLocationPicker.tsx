"use client";

import { useState, useTransition } from "react";
import { MapPin, Check } from "lucide-react";
import { LocationPicker } from "@/app/data-pelanggan/LocationPicker";
import { setDepotLocationAction } from "./actions";

export function DepotLocationPicker({
  currentLat,
  currentLng,
}: {
  currentLat: number | null;
  currentLng: number | null;
}) {
  const [lat, setLat] = useState<number | null>(currentLat);
  const [lng, setLng] = useState<number | null>(currentLng);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const isDirty = lat !== currentLat || lng !== currentLng;

  return (
    <div className="bg-surface border border-line rounded-2xl p-4 space-y-3">
      <div>
        <h2 className="font-semibold inline-flex items-center gap-1.5">
          <MapPin size={16} /> Lokasi Depot di Peta
        </h2>
        <p className="text-xs text-[color:var(--muted)] mt-1">
          Set titik fisik depot di peta. Dipakai untuk menghitung jarak
          pengantaran ke pelanggan & validasi area antar.
        </p>
      </div>

      <LocationPicker
        lat={lat}
        lng={lng}
        onChange={(la, ln) => {
          if (isNaN(la) || isNaN(ln)) {
            setLat(null);
            setLng(null);
          } else {
            setLat(la);
            setLng(ln);
          }
        }}
      />

      {msg && (
        <p className={`text-xs ${msg.ok ? "text-emerald-700" : "text-rose-600"}`}>
          {msg.ok && <Check className="inline" size={12} />} {msg.text}
        </p>
      )}

      <button
        type="button"
        disabled={pending || !isDirty}
        onClick={() => {
          setMsg(null);
          startTransition(async () => {
            const r = await setDepotLocationAction(lat, lng);
            if ("error" in r) setMsg({ ok: false, text: r.error });
            else setMsg({ ok: true, text: "Lokasi depot tersimpan" });
          });
        }}
        className="px-4 py-2 bg-brand text-white rounded-md text-sm font-bold disabled:opacity-50"
      >
        {pending ? "Menyimpan..." : "Simpan Lokasi Depot"}
      </button>
    </div>
  );
}
