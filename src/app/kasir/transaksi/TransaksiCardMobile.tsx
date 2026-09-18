"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { DetailModal } from "@/components/DetailModal";
import { formatRupiah } from "@/lib/utils";

export type TransaksiCardData = {
  id: number;
  nomorNota: string;
  createdAt: Date;
  pelangganNama: string | null;
  kasir: string | null;
  kurirNama: string | null;
  metodeBayar: string;
  total: number;
  voidedAt: Date | null;
  refOrderId: number | null;
  alamatAntar: string | null;
};

/**
 * Mobile card layout untuk 1 transaksi. Tap → open DetailModal.
 * Dipakai di /kasir/transaksi hanya di viewport <sm (mobile).
 * Desktop tetap pakai table view existing.
 */
export function TransaksiCardMobile({ row }: { row: TransaksiCardData }) {
  const [open, setOpen] = useState(false);
  const isAntar = row.refOrderId !== null;
  const isWalkinDepot = isAntar && row.alamatAntar === "(diambil di depot)";
  const sumberLabel = isAntar
    ? isWalkinDepot
      ? "🏪 POS DEPOT"
      : "🚛 ANTAR"
    : "🏪 POS DEPOT";
  const sumberBadgeClass =
    isAntar && !isWalkinDepot
      ? "bg-amber-100 text-amber-800 border-amber-200"
      : "bg-sky-100 text-sky-800 border-sky-200";
  const displayNama = isAntar ? row.kurirNama ?? "—" : row.kasir ?? "—";
  const displayRole = isAntar && !isWalkinDepot ? "KURIR" : "KASIR";

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`w-full text-left bg-surface border border-line rounded-2xl p-3 space-y-2 hover:border-brand transition ${
          row.voidedAt ? "opacity-60" : ""
        }`}
      >
        {/* Row 1: pelanggan + total */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="font-bold text-sm truncate">
              {row.pelangganNama ?? (
                <span className="text-[color:var(--muted)]">Walk-in</span>
              )}
            </div>
            {isAntar && !isWalkinDepot && row.alamatAntar && (
              <div className="text-[10px] text-[color:var(--muted)] truncate mt-0.5">
                📍 {row.alamatAntar}
              </div>
            )}
          </div>
          <div className="text-right shrink-0">
            <div
              className={`font-extrabold text-base ${
                row.voidedAt ? "line-through text-[color:var(--muted)]" : "text-slate-900"
              }`}
            >
              {formatRupiah(row.total)}
            </div>
            {row.voidedAt && (
              <span className="inline-block mt-0.5 text-[9px] px-1.5 py-0.5 bg-rose-600 text-white rounded font-extrabold tracking-wider">
                ⊗ BATAL
              </span>
            )}
          </div>
        </div>

        {/* Row 2: meta info (waktu + nomor nota + sumber + bayar) */}
        <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
          <span className="text-[color:var(--muted)]">
            {row.createdAt.toLocaleString("id-ID", {
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          <span className="text-[color:var(--muted)]">·</span>
          <span className="font-mono text-[color:var(--muted)]">{row.nomorNota}</span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-1.5 pt-2 border-t border-line">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold border ${sumberBadgeClass}`}
            >
              {sumberLabel}
            </span>
            <span className="text-[10px] uppercase font-bold text-[color:var(--muted)]">
              {row.metodeBayar}
            </span>
            <span className="text-[10px] text-[color:var(--muted)]">
              · {displayRole.toLowerCase()}: {displayNama}
            </span>
          </div>
          <span className="text-brand text-xs font-bold inline-flex items-center gap-0.5">
            Detail <ArrowRight size={12} />
          </span>
        </div>
      </button>
      {open && (
        <DetailModal
          kind="transaksi"
          id={row.id}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
