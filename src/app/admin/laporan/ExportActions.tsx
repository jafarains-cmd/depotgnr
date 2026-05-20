"use client";

import { Printer, FileSpreadsheet } from "lucide-react";

export function ExportActions({
  jenis,
  params,
}: {
  jenis: "ringkasan" | "penjualan" | "order-antar" | "pengeluaran" | "bonus-kurir";
  params: Record<string, string | undefined>;
}) {
  const qs = new URLSearchParams();
  qs.set("jenis", jenis);
  for (const [k, v] of Object.entries(params)) {
    if (v) qs.set(k, v);
  }
  const csvUrl = `/api/laporan/export?${qs.toString()}`;
  return (
    <div className="flex flex-wrap gap-2 no-print">
      <button
        type="button"
        onClick={() => window.print()}
        className="px-3 py-2 bg-slate-800 text-white rounded-md text-xs font-bold inline-flex items-center gap-1.5"
        title="Cetak / Save as PDF lewat dialog cetak browser"
      >
        <Printer size={13} /> Cetak / PDF
      </button>
      <a
        href={csvUrl}
        className="px-3 py-2 bg-emerald-600 text-white rounded-md text-xs font-bold inline-flex items-center gap-1.5"
        title="Download CSV — buka langsung di Excel / Google Sheets"
      >
        <FileSpreadsheet size={13} /> Excel (CSV)
      </a>
    </div>
  );
}
