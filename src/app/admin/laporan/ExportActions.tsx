"use client";

import { Printer, FileSpreadsheet, FileText } from "lucide-react";

export function ExportActions({ from, to }: { from: string; to: string }) {
  const csvUrl = `/api/laporan/export?from=${from}&to=${to}&format=csv`;
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => window.print()}
        className="px-3 py-2 bg-slate-800 text-white rounded-md text-xs font-bold inline-flex items-center gap-1.5"
        title="Buka dialog cetak browser → pilih Save as PDF untuk simpan PDF"
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
      <span className="text-[10px] text-[color:var(--muted)] inline-flex items-center gap-1">
        <FileText size={11} /> Save PDF lewat dialog cetak browser
      </span>
    </div>
  );
}
