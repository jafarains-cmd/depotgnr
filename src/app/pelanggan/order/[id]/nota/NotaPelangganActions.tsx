"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Printer, FileDown, Send, Copy, Check, ArrowLeft } from "lucide-react";
import { getOrderNotaText } from "./actions";
import { PrintThermalButton } from "@/components/PrintThermalButton";
import type { NotaData } from "@/lib/nota-to-escpos";

export function NotaPelangganActions({
  orderId,
  nota,
}: {
  orderId: number;
  nota: NotaData;
}) {
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [shareNomor, setShareNomor] = useState("");
  const [showShare, setShowShare] = useState(false);

  function handleCetak() {
    window.print();
  }

  function handleCopy() {
    startTransition(async () => {
      const text = await getOrderNotaText(orderId);
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleShareWA() {
    startTransition(async () => {
      const text = await getOrderNotaText(orderId);
      const target = shareNomor.replace(/\D/g, "");
      const phone = target.startsWith("0")
        ? `62${target.slice(1)}`
        : target.startsWith("62")
          ? target
          : "";
      const url = phone
        ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
        : `https://wa.me/?text=${encodeURIComponent(text)}`;
      window.open(url, "_blank", "noopener");
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Link
          href="/pelanggan/riwayat"
          className="text-sm text-[color:var(--muted)] hover:text-brand inline-flex items-center gap-1"
        >
          <ArrowLeft size={14} /> Kembali ke Riwayat
        </Link>
      </div>

      <div className="bg-surface border border-line rounded-2xl p-3 space-y-2">
        <PrintThermalButton nota={nota} className="w-full justify-center" />
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleCetak}
            className="py-2 bg-slate-800 text-white rounded-md text-sm inline-flex items-center justify-center gap-1.5"
          >
            <Printer size={14} /> Cetak (Browser)
          </button>
          <button
            onClick={handleCetak}
            className="py-2 border border-line rounded-md text-sm inline-flex items-center justify-center gap-1.5"
            title="Pakai dialog cetak browser → pilih Save as PDF"
          >
            <FileDown size={14} /> Save PDF
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setShowShare((v) => !v)}
            className="py-2 bg-emerald-600 text-white rounded-md text-sm inline-flex items-center justify-center gap-1.5"
          >
            <Send size={14} /> Share WA
          </button>
          <button
            onClick={handleCopy}
            disabled={pending}
            className="py-2 border border-line rounded-md text-sm inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
            {copied ? "Tersalin" : "Salin"}
          </button>
        </div>

        {showShare && (
          <div className="border-t pt-2 space-y-2">
            <input
              type="tel"
              inputMode="numeric"
              value={shareNomor}
              onChange={(e) => setShareNomor(e.target.value)}
              placeholder="Nomor WA tujuan (kosongkan = pilih kontak)"
              className="w-full px-3 py-1.5 border border-line rounded-md text-sm"
            />
            <button
              onClick={handleShareWA}
              disabled={pending}
              className="w-full py-1.5 bg-emerald-600 text-white rounded-md text-xs disabled:opacity-50"
            >
              Buka WhatsApp
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
