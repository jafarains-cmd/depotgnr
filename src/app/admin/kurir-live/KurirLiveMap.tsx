"use client";

import { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Popup } from "react-leaflet";
import L from "leaflet";
import type { Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";
import type { KurirLiveRow } from "./KurirLiveClient";

const kurirIcon = L.divIcon({
  className: "kurir-live-marker",
  html: `<div style="font-size:26px;line-height:1">🛵</div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

const tujuanIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

export function KurirLiveMap({
  rows,
  focusOrderId,
}: {
  rows: KurirLiveRow[];
  focusOrderId: number | null;
}) {
  const mapRef = useRef<LeafletMap | null>(null);

  const center = useMemo<[number, number]>(() => {
    if (rows.length === 0) return [-6.2, 106.816];
    const lats = rows.map((r) => r.kurirLat!).filter((v) => v !== null);
    const lngs = rows.map((r) => r.kurirLng!).filter((v) => v !== null);
    return [
      lats.reduce((a, b) => a + b, 0) / lats.length,
      lngs.reduce((a, b) => a + b, 0) / lngs.length,
    ];
  }, [rows]);

  useEffect(() => {
    if (!mapRef.current || focusOrderId === null) return;
    const focused = rows.find((r) => r.orderId === focusOrderId);
    if (focused?.kurirLat && focused?.kurirLng) {
      mapRef.current.flyTo([focused.kurirLat, focused.kurirLng], 16, { duration: 0.8 });
    }
  }, [focusOrderId, rows]);

  return (
    <MapContainer
      center={center}
      zoom={13}
      style={{ height: "100%", width: "100%" }}
      ref={(m) => {
        mapRef.current = m;
      }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {rows.flatMap((r) => {
        if (r.kurirLat === null || r.kurirLng === null) return [];
        const isFocused = focusOrderId === r.orderId;
        const items = [
          <Marker
            key={`k-${r.orderId}`}
            position={[r.kurirLat, r.kurirLng]}
            icon={kurirIcon}
          >
            <Popup>
              <div className="text-xs space-y-0.5">
                <div className="font-bold">{r.kurirName}</div>
                <div>
                  #{r.nomorOrder} · {r.status}
                </div>
                {r.pelangganNama && <div>→ {r.pelangganNama}</div>}
                {r.accuracy && (
                  <div className="text-slate-500">
                    Akurasi ±{Math.round(r.accuracy)}m
                  </div>
                )}
              </div>
            </Popup>
          </Marker>,
        ];
        if (r.tujuanLat !== null && r.tujuanLng !== null) {
          items.push(
            <Marker
              key={`t-${r.orderId}`}
              position={[r.tujuanLat, r.tujuanLng]}
              icon={tujuanIcon}
            >
              <Popup>
                <div className="text-xs space-y-0.5">
                  <div className="font-bold">Tujuan</div>
                  {r.pelangganNama && <div>{r.pelangganNama}</div>}
                  {r.alamatAntar && (
                    <div className="text-slate-500">{r.alamatAntar}</div>
                  )}
                </div>
              </Popup>
            </Marker>,
            <Polyline
              key={`l-${r.orderId}`}
              positions={[
                [r.kurirLat, r.kurirLng],
                [r.tujuanLat, r.tujuanLng],
              ]}
              pathOptions={{
                color: isFocused ? "#2563eb" : "#94a3b8",
                weight: isFocused ? 3 : 2,
                dashArray: "6 6",
                opacity: isFocused ? 0.8 : 0.5,
              }}
            />,
          );
        }
        return items;
      })}
    </MapContainer>
  );
}
