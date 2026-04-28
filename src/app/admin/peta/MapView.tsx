"use client";

import { useEffect, useState } from "react";
import { MapViewGoogle } from "./MapViewGoogle";
import { MapViewOSM } from "./MapViewOSM";
import type { PelangganGeo } from "./PetaClient";

export function MapView({ pelanggan }: { pelanggan: PelangganGeo[] }) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const [provider, setProvider] = useState<"google" | "osm">(apiKey ? "google" : "osm");

  // Timeout fallback: kalau Google Maps tidak load dalam 8 detik (e.g. blokir/network),
  // pindah ke OSM. Reset kalau provider Google sudah aktif.
  useEffect(() => {
    if (provider !== "google") return;
    const t = setTimeout(() => {
      if (typeof window !== "undefined" && !(window as { google?: object }).google) {
        console.warn("[maps] Google Maps tidak load — fallback ke OSM");
        setProvider("osm");
      }
    }, 8000);
    return () => clearTimeout(t);
  }, [provider]);

  if (provider === "google" && apiKey) {
    return (
      <div className="relative h-full w-full">
        <MapViewGoogle
          apiKey={apiKey}
          pelanggan={pelanggan}
          onFail={() => {
            console.warn("[maps] Google Maps error — fallback ke OSM");
            setProvider("osm");
          }}
        />
      </div>
    );
  }
  return (
    <div className="relative h-full w-full">
      <MapViewOSM pelanggan={pelanggan} />
      {!apiKey && (
        <div className="absolute bottom-2 right-2 bg-amber-50 border border-amber-200 text-amber-800 text-xs px-2 py-1 rounded shadow-sm">
          OpenStreetMap (set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY untuk Google Maps)
        </div>
      )}
    </div>
  );
}
