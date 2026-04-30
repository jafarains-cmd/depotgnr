"use client";

import { useMemo, useState } from "react";
import { APIProvider, Map, AdvancedMarker, InfoWindow, Pin } from "@vis.gl/react-google-maps";
import Link from "next/link";
import { formatRupiah } from "@/lib/utils";
import type { PelangganGeo } from "./PetaClient";

export function MapViewGoogle({
  apiKey,
  pelanggan,
  onFail,
}: {
  apiKey: string;
  pelanggan: PelangganGeo[];
  onFail: () => void;
}) {
  const [active, setActive] = useState<PelangganGeo | null>(null);

  const center = useMemo<{ lat: number; lng: number }>(() => {
    if (pelanggan.length === 0) return { lat: -6.2, lng: 106.816 };
    const lats = pelanggan.map((p) => p.lat);
    const lngs = pelanggan.map((p) => p.lng);
    return {
      lat: lats.reduce((a, b) => a + b, 0) / lats.length,
      lng: lngs.reduce((a, b) => a + b, 0) / lngs.length,
    };
  }, [pelanggan]);

  return (
    <APIProvider apiKey={apiKey} onError={onFail}>
      <Map
        defaultCenter={center}
        defaultZoom={pelanggan.length > 0 ? 13 : 11}
        mapId="depot-air-peta"
        gestureHandling="greedy"
        disableDefaultUI={false}
        style={{ width: "100%", height: "100%" }}
      >
        {pelanggan.map((p) => (
          <AdvancedMarker
            key={p.id}
            position={{ lat: p.lat, lng: p.lng }}
            onClick={() => setActive(p)}
          >
            <Pin
              background={p.tipe === "langganan" ? "#2563eb" : "#0284c7"}
              borderColor="#fff"
              glyphColor="#fff"
            />
          </AdvancedMarker>
        ))}
        {active && (
          <InfoWindow
            position={{ lat: active.lat, lng: active.lng }}
            onCloseClick={() => setActive(null)}
            pixelOffset={[0, -32]}
          >
            <div className="space-y-1.5 min-w-[200px] text-ink">
              <div className="font-semibold text-base">{active.nama}</div>
              <div className="text-xs">
                <span
                  className={`px-1.5 py-0.5 rounded ${
                    active.tipe === "langganan"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-[color:var(--surface2)] text-[color:var(--muted)]"
                  }`}
                >
                  {active.tipe}
                </span>
              </div>
              {active.telp && (
                <div className="text-xs">
                  📞 <a href={`tel:${active.telp}`} className="text-brand-600">{active.telp}</a>
                </div>
              )}
              {active.alamat && <div className="text-xs">📍 {active.alamat}</div>}

              <div className="border-t pt-1.5 mt-1.5 text-xs space-y-0.5">
                <div className="flex justify-between">
                  <span>Total belanja:</span>
                  <span className="font-medium">{formatRupiah(active.totalBelanja)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Jumlah transaksi:</span>
                  <span>{active.jumlahTransaksi}×</span>
                </div>
                <div className="flex justify-between">
                  <span>Total order:</span>
                  <span>{active.jumlahOrder}×</span>
                </div>
                {active.orderPending > 0 && (
                  <div className="flex justify-between text-amber-700 font-medium">
                    <span>Order aktif:</span>
                    <span>{active.orderPending}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-1.5 border-t">
                <Link
                  href={`/admin/pelanggan?id=${active.id}`}
                  className="flex-1 text-center text-xs bg-brand-600 text-white py-1 rounded"
                >
                  Edit
                </Link>
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${active.lat},${active.lng}`}
                  target="_blank"
                  rel="noopener"
                  className="flex-1 text-center text-xs border border-line py-1 rounded"
                >
                  Rute
                </a>
              </div>
            </div>
          </InfoWindow>
        )}
      </Map>
    </APIProvider>
  );
}
