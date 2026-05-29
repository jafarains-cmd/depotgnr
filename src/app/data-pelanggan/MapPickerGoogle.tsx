"use client";

import { useState } from "react";
import { APIProvider, Map, AdvancedMarker, Pin, useMap } from "@vis.gl/react-google-maps";
import { useEffect } from "react";

export function MapPickerGoogle({
  apiKey,
  lat,
  lng,
  onPick,
  onFail,
}: {
  apiKey: string;
  lat: number | null;
  lng: number | null;
  onPick: (lat: number, lng: number) => void;
  onFail: () => void;
}) {
  const [marker, setMarker] = useState<{ lat: number; lng: number } | null>(
    lat !== null && lng !== null ? { lat, lng } : null,
  );
  const [geoBusy, setGeoBusy] = useState(false);

  // Auto-request lokasi user saat mount kalau belum ada marker
  useEffect(() => {
    if (marker) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const m = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setMarker(m);
        onPick(m.lat, m.lng);
      },
      () => {},
      { timeout: 8000, maximumAge: 60_000 },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function locateMe() {
    if (!navigator.geolocation) return;
    setGeoBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const m = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setMarker(m);
        onPick(m.lat, m.lng);
        setGeoBusy(false);
      },
      () => setGeoBusy(false),
      { timeout: 8000, maximumAge: 0 },
    );
  }

  // Default center: lokasi depot (Gorontalo)
  const center = marker ?? { lat: 0.5451158, lng: 123.0397047 };

  return (
    <div style={{ position: "relative", height: "100%", width: "100%" }}>
      <APIProvider apiKey={apiKey} onError={onFail}>
        <Map
          defaultCenter={center}
          defaultZoom={marker ? 16 : 14}
          mapId="depot-air-picker"
          gestureHandling="greedy"
          disableDefaultUI={false}
          style={{ width: "100%", height: "100%" }}
        >
          <ClickHandler
            onClick={(la, ln) => {
              setMarker({ lat: la, lng: ln });
              onPick(la, ln);
            }}
          />
          {marker && (
            <AdvancedMarker position={marker}>
              <Pin background="#0284c7" borderColor="#fff" glyphColor="#fff" />
            </AdvancedMarker>
          )}
        </Map>
      </APIProvider>

      <button
        type="button"
        onClick={locateMe}
        disabled={geoBusy}
        title="Pakai lokasi saya sekarang"
        className="absolute bottom-3 right-3 z-10 bg-white hover:bg-brand-50 border border-line rounded-full shadow-lg px-3 py-2 text-xs font-bold inline-flex items-center gap-1 disabled:opacity-50"
      >
        📍 {geoBusy ? "Mencari..." : "Lokasi Saya"}
      </button>
    </div>
  );
}

function ClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const listener = map.addListener("click", (e: google.maps.MapMouseEvent) => {
      if (e.latLng) onClick(e.latLng.lat(), e.latLng.lng());
    });
    return () => listener.remove();
  }, [map, onClick]);
  return null;
}
