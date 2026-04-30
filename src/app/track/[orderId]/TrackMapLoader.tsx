"use client";

import dynamic from "next/dynamic";

const TrackMap = dynamic(() => import("./TrackMap").then((m) => m.TrackMap), {
  ssr: false,
  loading: () => <div className="p-8 text-center text-[color:var(--muted)]">Memuat peta...</div>,
});

export function TrackMapLoader({ orderId, token }: { orderId: number; token: string }) {
  return <TrackMap orderId={orderId} token={token} />;
}
