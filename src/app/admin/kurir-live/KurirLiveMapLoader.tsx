"use client";

import dynamic from "next/dynamic";
import type { KurirLiveRow } from "./KurirLiveClient";

const KurirLiveMap = dynamic(
  () => import("./KurirLiveMap").then((m) => m.KurirLiveMap),
  {
    ssr: false,
    loading: () => (
      <div className="p-8 text-center text-[color:var(--muted)]">Memuat peta...</div>
    ),
  },
);

export function KurirLiveMapLoader({
  rows,
  focusOrderId,
}: {
  rows: KurirLiveRow[];
  focusOrderId: number | null;
}) {
  return <KurirLiveMap rows={rows} focusOrderId={focusOrderId} />;
}
