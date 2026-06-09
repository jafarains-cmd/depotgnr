"use client";

import { useState } from "react";
import { Copy, Check, Share2, UserPlus, QrCode } from "lucide-react";

/**
 * Tombol bagikan link registrasi publik (untuk staff kasir/admin/kurir).
 * Tidak pakai kode referral — siapa saja bisa daftar pakai link ini.
 *
 * Optional: kalau pelanggan tertentu refer-able, pakai ShareReferralButton
 * (di /pelanggan/loyalty) supaya pelanggan dapat bonus referral.
 */
export function ShareRegistrationButton({
  namaDepot = "Depot Air Minum",
}: {
  namaDepot?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const url =
    typeof window !== "undefined" ? `${window.location.origin}/register` : "/register";
  const text = `Halo! Daftar akun ${namaDepot} biar order air galon makin gampang + dapat saldo loyalty tiap beli:\n\n${url}`;

  function copy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function copyUrl() {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function shareWA() {
    const wa = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(wa, "_blank", "noopener");
  }

  return (
    <div className="bg-surface border border-line rounded-2xl p-3 sm:p-4 space-y-2.5">
      <div className="flex items-center gap-2">
        <UserPlus size={16} className="text-brand" />
        <h3 className="font-bold text-sm">Bagikan Link Daftar</h3>
      </div>
      <p className="text-xs text-[color:var(--muted)]">
        Bagikan ke pelanggan baru via WA atau tunjukkan link langsung.
      </p>
      <div className="bg-[color:var(--surface2)] rounded-md px-2 py-1.5 font-mono text-[11px] text-[color:var(--muted)] break-all">
        {url}
      </div>
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={shareWA}
          className="flex-1 min-w-[120px] px-3 py-2 bg-emerald-600 text-white rounded-md text-sm inline-flex items-center justify-center gap-1.5 font-bold"
        >
          <Share2 size={14} /> Bagikan via WA
        </button>
        <button
          onClick={copy}
          className="px-3 py-2 bg-[color:var(--surface2)] border border-line rounded-md text-sm inline-flex items-center justify-center gap-1.5"
          title="Salin pesan + link"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "Tersalin" : "Salin pesan"}
        </button>
        <button
          onClick={copyUrl}
          className="px-3 py-2 bg-[color:var(--surface2)] border border-line rounded-md text-sm inline-flex items-center justify-center gap-1.5"
          title="Salin URL saja"
        >
          <Copy size={14} /> URL
        </button>
        <button
          onClick={() => setShowQr((v) => !v)}
          className="px-3 py-2 bg-[color:var(--surface2)] border border-line rounded-md text-sm inline-flex items-center justify-center gap-1.5"
          title="Tampilkan QR Code"
        >
          <QrCode size={14} /> QR
        </button>
      </div>
      {showQr && (
        <div className="border-t border-line pt-3 text-center">
          {/* QR code dari API eksternal (qrserver) — pelanggan tinggal scan */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(url)}&size=240x240&margin=10`}
            alt="QR Code Daftar"
            className="mx-auto rounded-lg bg-white p-1"
            width={240}
            height={240}
          />
          <div className="text-[11px] text-[color:var(--muted)] mt-2">
            Scan QR ini untuk buka halaman daftar
          </div>
        </div>
      )}
    </div>
  );
}
