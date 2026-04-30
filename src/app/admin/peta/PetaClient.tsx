"use client";

import dynamic from "next/dynamic";

export type PelangganGeo = {
  id: number;
  nama: string;
  telp: string | null;
  alamat: string | null;
  tipe: "umum" | "langganan";
  lat: number;
  lng: number;
  totalBelanja: number;
  jumlahTransaksi: number;
  jumlahOrder: number;
  orderPending: number;
};

// Wrapper switcher Google ↔ OSM — load client-only
const MapView = dynamic(() => import("./MapView").then((m) => m.MapView), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center text-[color:var(--muted)]">
      Memuat peta...
    </div>
  ),
});

export function PetaClient({ pelanggan }: { pelanggan: PelangganGeo[] }) {
  return <MapView pelanggan={pelanggan} />;
}
