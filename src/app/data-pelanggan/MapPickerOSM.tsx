"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const icon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

function ClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => onClick(e.latlng.lat, e.latlng.lng),
  });
  return null;
}

function MapRecenter({ lat, lng }: { lat: number | null; lng: number | null }) {
  const map = useMap();
  useEffect(() => {
    if (lat !== null && lng !== null) {
      map.setView([lat, lng], 16, { animate: true });
    }
  }, [lat, lng, map]);
  return null;
}

export function MapPickerOSM({
  lat,
  lng,
  onPick,
}: {
  lat: number | null;
  lng: number | null;
  onPick: (lat: number, lng: number) => void;
}) {
  const [marker, setMarker] = useState<[number, number] | null>(
    lat !== null && lng !== null ? [lat, lng] : null,
  );
  const [geoBusy, setGeoBusy] = useState(false);

  // Sync marker dengan prop lat/lng (untuk hasil pencarian / external picker)
  useEffect(() => {
    if (lat !== null && lng !== null) {
      setMarker([lat, lng]);
    }
  }, [lat, lng]);

  // Coba minta lokasi user otomatis saat mount KALAU belum ada marker.
  // Browser akan minta izin — kalau ditolak/gagal, fallback ke default depot.
  useEffect(() => {
    if (marker) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const la = pos.coords.latitude;
        const ln = pos.coords.longitude;
        setMarker([la, ln]);
        onPick(la, ln);
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
        const la = pos.coords.latitude;
        const ln = pos.coords.longitude;
        setMarker([la, ln]);
        onPick(la, ln);
        setGeoBusy(false);
      },
      () => setGeoBusy(false),
      { timeout: 8000, maximumAge: 0 },
    );
  }

  // Default center: lokasi depot (Gorontalo). Pakai marker kalau sudah ada.
  const center: [number, number] = marker ?? [0.5451158, 123.0397047];

  function handleClick(la: number, ln: number) {
    setMarker([la, ln]);
    onPick(la, ln);
  }

  return (
    <div style={{ position: "relative", height: "100%", width: "100%" }}>
      <MapContainer
        center={center}
        zoom={marker ? 16 : 14}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickHandler onClick={handleClick} />
        <MapRecenter lat={lat} lng={lng} />
        {marker && <Marker position={marker} icon={icon} />}
      </MapContainer>

      <button
        type="button"
        onClick={locateMe}
        disabled={geoBusy}
        title="Pakai lokasi saya sekarang"
        className="absolute bottom-3 right-3 z-[1000] bg-white hover:bg-brand-50 border border-line rounded-full shadow-lg px-3 py-2 text-xs font-bold inline-flex items-center gap-1 disabled:opacity-50"
      >
        📍 {geoBusy ? "Mencari..." : "Lokasi Saya"}
      </button>
    </div>
  );
}
