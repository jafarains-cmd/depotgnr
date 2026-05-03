"use client";

import Link from "next/link";
import { Printer, FileDown, ArrowLeft } from "lucide-react";

export function NotaKasirActions() {
  function handleCetak() {
    window.print();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Link
          href="/kasir/order"
          className="text-sm text-[color:var(--muted)] hover:text-brand inline-flex items-center gap-1"
        >
          <ArrowLeft size={14} /> Kembali ke Order
        </Link>
      </div>

      <div className="bg-surface border border-line rounded-2xl p-3">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleCetak}
            className="py-2 bg-slate-800 text-white rounded-md text-sm inline-flex items-center justify-center gap-1.5"
          >
            <Printer size={14} /> Cetak
          </button>
          <button
            onClick={handleCetak}
            className="py-2 border border-line rounded-md text-sm inline-flex items-center justify-center gap-1.5"
            title="Pakai dialog cetak browser → pilih Save as PDF"
          >
            <FileDown size={14} /> Save PDF
          </button>
        </div>
      </div>
    </div>
  );
}
