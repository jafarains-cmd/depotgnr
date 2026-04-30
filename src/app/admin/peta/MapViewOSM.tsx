"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import Link from "next/link";
import { useMemo } from "react";
import { formatRupiah } from "@/lib/utils";
import type { PelangganGeo } from "./PetaClient";

// Fix marker default icon (leaflet bundling issue di Next.js)
const defaultIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const langgananIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [30, 49],
  iconAnchor: [15, 49],
  popupAnchor: [1, -40],
  className: "hue-rotate-blue",
});

export function MapViewOSM({ pelanggan }: { pelanggan: PelangganGeo[] }) {
  const center = useMemo<[number, number]>(() => {
    if (pelanggan.length === 0) return [-6.2, 106.816]; // Jakarta default
    const lats = pelanggan.map((p) => p.lat);
    const lngs = pelanggan.map((p) => p.lng);
    return [
      lats.reduce((a, b) => a + b, 0) / lats.length,
      lngs.reduce((a, b) => a + b, 0) / lngs.length,
    ];
  }, [pelanggan]);

  return (
    <MapContainer
      center={center}
      zoom={pelanggan.length > 0 ? 13 : 11}
      style={{ height: "100%", width: "100%" }}
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {pelanggan.map((p) => (
        <Marker
          key={p.id}
          position={[p.lat, p.lng]}
          icon={p.tipe === "langganan" ? langgananIcon : defaultIcon}
        >
          <Popup>
            <div className="space-y-1.5 min-w-[200px]">
              <div className="font-semibold text-base">{p.nama}</div>
              <div className="text-xs">
                <span
                  className={`px-1.5 py-0.5 rounded ${
                    p.tipe === "langganan"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-[color:var(--surface2)] text-[color:var(--muted)]"
                  }`}
                >
                  {p.tipe}
                </span>
              </div>
              {p.telp && (
                <div className="text-xs">
                  📞 <a href={`tel:${p.telp}`} className="text-brand-600">{p.telp}</a>
                </div>
              )}
              {p.alamat && <div className="text-xs">📍 {p.alamat}</div>}

              <div className="border-t pt-1.5 mt-1.5 text-xs space-y-0.5">
                <div className="flex justify-between">
                  <span>Total belanja:</span>
                  <span className="font-medium">{formatRupiah(p.totalBelanja)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Jumlah transaksi:</span>
                  <span>{p.jumlahTransaksi}×</span>
                </div>
                <div className="flex justify-between">
                  <span>Total order:</span>
                  <span>{p.jumlahOrder}×</span>
                </div>
                {p.orderPending > 0 && (
                  <div className="flex justify-between text-amber-700 font-medium">
                    <span>Order aktif:</span>
                    <span>{p.orderPending}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-1.5 border-t">
                <Link
                  href={`/admin/pelanggan?id=${p.id}`}
                  className="flex-1 text-center text-xs bg-brand-600 text-white py-1 rounded"
                >
                  Edit
                </Link>
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`}
                  target="_blank"
                  rel="noopener"
                  className="flex-1 text-center text-xs border border-line py-1 rounded"
                >
                  Rute
                </a>
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
