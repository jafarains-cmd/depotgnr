"use client";

import { useState } from "react";
import { Copy, Check, Share2 } from "lucide-react";

export function ShareReferralButton({ kode, nama }: { kode: string; nama: string }) {
  const [copied, setCopied] = useState(false);
  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/register?ref=${kode}`
      : `/register?ref=${kode}`;
  const text = `Halo, daftar di Depot Air pakai kode referral saya *${kode}* — kita berdua dapat saldo Rp 5.000! ${url}`;

  function copy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function shareWA() {
    const wa = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(wa, "_blank", "noopener");
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={shareWA}
        className="flex-1 px-3 py-2 bg-emerald-600 text-white rounded-md text-sm inline-flex items-center justify-center gap-1.5"
      >
        <Share2 size={14} /> Bagikan via WA
      </button>
      <button
        onClick={copy}
        className="px-3 py-2 bg-slate-100 rounded-md text-sm inline-flex items-center justify-center gap-1.5"
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
        {copied ? "Tersalin" : "Salin"}
      </button>
    </div>
  );
}
