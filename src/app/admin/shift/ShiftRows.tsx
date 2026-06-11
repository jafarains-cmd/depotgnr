"use client";

import { useState } from "react";
import { DetailModal } from "@/components/DetailModal";
import { ForceCloseButton } from "./ForceCloseButton";
import { formatRupiah } from "@/lib/utils";

export type Row = {
  id: number;
  kasirNama: string | null;
  kasirRole: string | null;
  openingCash: number | null;
  closingCashCounted: number | null;
  closingCashExpected: number | null;
  selisih: number | null;
  catatan: string | null;
  status: string;
  openedAt: Date;
  closedAt: Date | null;
  closedByNama: string | null;
  reopenedAt: Date | null;
  stale: boolean;
  expectedForOpen: number; // pre-computed for force close
};

export function ShiftRows({ rows }: { rows: Row[] }) {
  const [detailId, setDetailId] = useState<number | null>(null);

  return (
    <div className="bg-surface border border-line rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[color:var(--surface2)] text-[color:var(--muted)] text-left text-xs">
            <tr>
              <th className="p-3">Kasir</th>
              <th className="p-3">Buka</th>
              <th className="p-3">Tutup</th>
              <th className="p-3 text-right">Uang awal</th>
              <th className="p-3 text-right">Ekspektasi</th>
              <th className="p-3 text-right">Fisik</th>
              <th className="p-3 text-right">Selisih</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
        <tr
          key={r.id}
          className={`${r.stale ? "bg-red-50" : ""} hover:bg-[color:var(--surface2)] cursor-pointer`}
          onClick={() => setDetailId(r.id)}
        >
          <td className="p-3 text-xs">
            <div className="font-bold">{r.kasirNama ?? "—"}</div>
            <div className="text-[10px] text-[color:var(--muted)] uppercase">
              {r.kasirRole ?? "—"}
            </div>
            {r.catatan && (
              <div className="text-[10px] italic text-[color:var(--muted)] mt-1 max-w-[200px]">
                "{r.catatan}"
              </div>
            )}
          </td>
          <td className="p-3 text-xs whitespace-nowrap">
            {r.openedAt.toLocaleString("id-ID", {
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
            {r.reopenedAt && (
              <div className="text-[10px] text-amber-700 mt-0.5">↻ reopened</div>
            )}
          </td>
          <td className="p-3 text-xs whitespace-nowrap">
            {r.closedAt
              ? r.closedAt.toLocaleString("id-ID", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "—"}
            {r.closedByNama && r.closedByNama !== r.kasirNama && (
              <div className="text-[10px] text-[color:var(--muted)]">by {r.closedByNama}</div>
            )}
          </td>
          <td className="p-3 text-xs text-right font-mono">
            {r.openingCash !== null ? formatRupiah(r.openingCash) : "—"}
          </td>
          <td className="p-3 text-xs text-right font-mono">
            {r.closingCashExpected !== null ? formatRupiah(r.closingCashExpected) : "—"}
          </td>
          <td className="p-3 text-xs text-right font-mono">
            {r.closingCashCounted !== null ? formatRupiah(r.closingCashCounted) : "—"}
          </td>
          <td
            className={`p-3 text-xs text-right font-mono font-bold ${
              (r.selisih ?? 0) === 0
                ? "text-[color:var(--muted)]"
                : (r.selisih ?? 0) > 0
                  ? "text-emerald-700"
                  : "text-red-600"
            }`}
          >
            {r.selisih !== null
              ? `${r.selisih > 0 ? "+" : ""}${formatRupiah(r.selisih)}`
              : "—"}
          </td>
          <td className="p-3">
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                r.stale
                  ? "bg-red-600 text-white animate-pulse"
                  : r.status === "open"
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-[color:var(--surface2)] text-[color:var(--muted)]"
              }`}
            >
              {r.stale ? "STALE" : r.status.toUpperCase()}
            </span>
          </td>
          <td
            className="p-3 text-right"
            onClick={(e) => e.stopPropagation()}
          >
            {r.status === "open" && (
              <ForceCloseButton
                shiftId={r.id}
                kasirNama={r.kasirNama ?? "—"}
                expectedCash={r.expectedForOpen}
              />
            )}
          </td>
        </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="p-8 text-center text-[color:var(--muted)]">
                  Belum ada shift.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {detailId !== null && (
        <DetailModal kind="shift" id={detailId} onClose={() => setDetailId(null)} />
      )}
    </div>
  );
}
