"use client";

import { useEffect, useState, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const tujuanIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const kurirIcon = L.divIcon({
  className: "kurir-marker",
  html: `<div style="font-size:24px;line-height:1">🛵</div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

type Data = {
  ok: boolean;
  order: { nomorOrder: string; status: string; alamatAntar: string | null };
  tujuan: { lat: number; lng: number; nama: string } | null;
  kurir: {
    lat: number;
    lng: number;
    accuracy: number | null;
    speed: number | null;
    updatedAt: string;
  } | null;
};

export function TrackMap({ orderId, token }: { orderId: number; token: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchData() {
    try {
      const r = await fetch(`/api/track/${orderId}?token=${encodeURIComponent(token)}`);
      if (!r.ok) {
        const j = await r.json();
        setError(j.error ?? "Gagal load");
        setLoading(false);
        return;
      }
      const j = (await r.json()) as Data;
      setData(j);
      setError(null);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, 15_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const center = useMemo<[number, number]>(() => {
    if (data?.kurir) return [data.kurir.lat, data.kurir.lng];
    if (data?.tujuan) return [data.tujuan.lat, data.tujuan.lng];
    return [-6.2, 106.816];
  }, [data]);

  if (loading) {
    return <div className="p-8 text-center text-[color:var(--muted)]">Memuat peta...</div>;
  }
  if (error || !data) {
    return (
      <div className="p-8 text-center text-red-600">
        {error ?? "Tidak bisa load tracking"}
      </div>
    );
  }

  const isFinished = ["selesai", "batal"].includes(data.order.status);

  return (
    <div className="space-y-3">
      <div className="bg-surface border border-line rounded-2xl p-4 space-y-1">
        <div className="text-xs text-[color:var(--muted)] font-mono">{data.order.nomorOrder}</div>
        <div className="text-sm font-semibold capitalize">Status: {data.order.status}</div>
        {data.order.alamatAntar && (
          <div className="text-xs text-[color:var(--muted)]">📍 {data.order.alamatAntar}</div>
        )}
        {data.kurir && (
          <div className="text-xs text-[color:var(--muted)] mt-1">
            Kurir update terakhir:{" "}
            {new Date(data.kurir.updatedAt).toLocaleTimeString("id-ID", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </div>
        )}
        {!data.kurir && !isFinished && (
          <div className="text-xs text-amber-700 mt-1">
            Kurir belum mulai tracking. Tunggu sebentar...
          </div>
        )}
      </div>

      <div className="rounded-xl overflow-hidden border border-line" style={{ height: 400 }}>
        <MapContainer
          center={center}
          zoom={14}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom
        >
          <TileLayer
            attribution="&copy; OpenStreetMap"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {data.tujuan && (
            <Marker position={[data.tujuan.lat, data.tujuan.lng]} icon={tujuanIcon}>
              <Popup>Tujuan: {data.tujuan.nama}</Popup>
            </Marker>
          )}
          {data.kurir && (
            <Marker position={[data.kurir.lat, data.kurir.lng]} icon={kurirIcon}>
              <Popup>Kurir Anda</Popup>
            </Marker>
          )}
          {data.kurir && data.tujuan && (
            <Polyline
              positions={[
                [data.kurir.lat, data.kurir.lng],
                [data.tujuan.lat, data.tujuan.lng],
              ]}
              color="#0284c7"
              dashArray="6 6"
            />
          )}
        </MapContainer>
      </div>

      <div className="text-xs text-[color:var(--muted)] text-center">
        Auto-refresh tiap 15 detik
      </div>
    </div>
  );
}
