"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DetailModal } from "@/components/DetailModal";
import { ForceCloseButton } from "./ForceCloseButton";
import { formatRupiah } from "@/lib/utils";
import { editShiftCashAction } from "@/app/kasir/shift/actions";
import { X, Loader2, Pencil } from "lucide-react";

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
  const [editFor, setEditFor] = useState<Row | null>(null);

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
            {r.closingCashExpected !== null ? (
              formatRupiah(r.closingCashExpected)
            ) : r.status === "open" ? (
              <span title="Estimasi live: opening + omzet cash − pengeluaran">
                {formatRupiah(r.expectedForOpen)}
                <span className="text-[9px] text-[color:var(--muted)] block font-normal">
                  estimasi
                </span>
              </span>
            ) : (
              "—"
            )}
          </td>
          <td className="p-3 text-xs text-right font-mono">
            {r.closingCashCounted !== null ? (
              formatRupiah(r.closingCashCounted)
            ) : r.status === "open" ? (
              <span className="text-[10px] text-[color:var(--muted)] italic">
                (saat tutup)
              </span>
            ) : (
              "—"
            )}
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
            className="p-3 text-right whitespace-nowrap"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-end gap-1.5">
              <button
                onClick={() => setEditFor(r)}
                className="px-2 py-1 text-[10px] border border-amber-300 text-amber-700 rounded-md font-bold inline-flex items-center gap-1 hover:bg-amber-50"
                title="Edit uang awal (typo / koreksi)"
              >
                <Pencil size={10} /> Edit
              </button>
              {r.status === "open" && (
                <ForceCloseButton
                  shiftId={r.id}
                  kasirNama={r.kasirNama ?? "—"}
                  expectedCash={r.expectedForOpen}
                />
              )}
            </div>
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

      {editFor && <EditOpeningModal row={editFor} onClose={() => setEditFor(null)} />}
    </div>
  );
}

function EditOpeningModal({ row, onClose }: { row: Row; onClose: () => void }) {
  const router = useRouter();
  const [opening, setOpening] = useState(
    row.openingCash !== null ? String(row.openingCash) : "",
  );
  const [counted, setCounted] = useState(
    row.closingCashCounted !== null ? String(row.closingCashCounted) : "",
  );
  const [alasan, setAlasan] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isClosed = row.status === "closed";
  const openingNum = Number(opening);
  const countedNum = Number(counted);
  // Live preview selisih untuk closed shift
  // Pakai (counted - opening - existingExpectedDiff) approach:
  // expected = opening + omzet_cash - pengeluaran
  // omzet_cash - pengeluaran = old_expected - old_opening
  // expected_baru = opening_baru + (old_expected - old_opening)
  const omzetMinusPeng =
    row.closingCashExpected !== null && row.openingCash !== null
      ? row.closingCashExpected - row.openingCash
      : null;
  const previewExpected =
    omzetMinusPeng !== null && Number.isFinite(openingNum)
      ? Math.floor(openingNum) + omzetMinusPeng
      : null;
  const previewSelisih =
    previewExpected !== null && Number.isFinite(countedNum)
      ? Math.floor(countedNum) - previewExpected
      : null;

  function submit() {
    setError(null);
    if (opening.trim() === "") {
      setError("Uang awal wajib");
      return;
    }
    if (!Number.isFinite(openingNum) || openingNum < 0) {
      setError("Uang awal harus angka >= 0");
      return;
    }
    if (isClosed && counted.trim() === "") {
      setError("Uang fisik wajib untuk shift closed");
      return;
    }
    if (isClosed && (!Number.isFinite(countedNum) || countedNum < 0)) {
      setError("Uang fisik harus angka >= 0");
      return;
    }
    if (alasan.trim().length < 3) {
      setError("Alasan wajib (min 3 karakter)");
      return;
    }
    startTransition(async () => {
      const r = await editShiftCashAction({
        shiftId: row.id,
        newOpeningCash: Math.floor(openingNum),
        newClosingCashCounted: isClosed ? Math.floor(countedNum) : undefined,
        alasan,
      });
      if ("error" in r) setError(r.error);
      else {
        onClose();
        router.refresh();
      }
    });
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 grid place-items-center p-4">
      <div className="bg-surface rounded-2xl max-w-md w-full p-5 space-y-3">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="font-bold text-lg">Edit Uang Awal</h2>
            <div className="text-xs text-[color:var(--muted)] mt-0.5">
              Kasir: {row.kasirNama ?? "—"} ·{" "}
              <span
                className={
                  row.status === "open" ? "text-emerald-700 font-bold" : "text-[color:var(--muted)]"
                }
              >
                {row.status.toUpperCase()}
              </span>
            </div>
          </div>
          <button onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {isClosed && (
          <div className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded p-2">
            ⚠ Shift sudah ditutup. Ubah uang awal dan/atau uang fisik di laci —
            selisih dihitung ulang otomatis.
          </div>
        )}

        <div className="text-xs bg-[color:var(--surface2)] rounded p-2 space-y-0.5">
          <div className="text-[10px] font-bold text-[color:var(--muted)] uppercase tracking-wide mb-1">
            Sekarang
          </div>
          <div className="flex justify-between">
            <span className="text-[color:var(--muted)]">Uang awal</span>
            <b>{row.openingCash !== null ? formatRupiah(row.openingCash) : "—"}</b>
          </div>
          {isClosed && row.closingCashExpected !== null && (
            <div className="flex justify-between">
              <span className="text-[color:var(--muted)]">Ekspektasi</span>
              <b>{formatRupiah(row.closingCashExpected)}</b>
            </div>
          )}
          {isClosed && row.closingCashCounted !== null && (
            <div className="flex justify-between">
              <span className="text-[color:var(--muted)]">Uang fisik</span>
              <b>{formatRupiah(row.closingCashCounted)}</b>
            </div>
          )}
          {isClosed && (
            <div className="flex justify-between">
              <span className="text-[color:var(--muted)]">Selisih</span>
              <b
                className={
                  (row.selisih ?? 0) === 0
                    ? "text-[color:var(--muted)]"
                    : (row.selisih ?? 0) > 0
                      ? "text-emerald-700"
                      : "text-red-600"
                }
              >
                {(row.selisih ?? 0) > 0 ? "+" : ""}
                {formatRupiah(row.selisih ?? 0)}
              </b>
            </div>
          )}
        </div>

        <div>
          <label className="text-xs font-bold block mb-1">Uang Awal Baru (Rp)</label>
          <input
            type="number"
            min={0}
            value={opening}
            onChange={(e) => setOpening(e.target.value)}
            className="w-full px-3 py-2 border border-line rounded-md text-lg font-mono"
            autoFocus
          />
        </div>

        {isClosed && (
          <div>
            <label className="text-xs font-bold block mb-1">
              Uang Fisik di Laci Baru (Rp)
            </label>
            <input
              type="number"
              min={0}
              value={counted}
              onChange={(e) => setCounted(e.target.value)}
              className="w-full px-3 py-2 border border-line rounded-md text-lg font-mono"
            />
          </div>
        )}

        {isClosed && previewSelisih !== null && (
          <div
            className={`text-xs rounded p-2 ${
              previewSelisih === 0
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                : previewSelisih > 0
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-red-50 text-red-700 border border-red-200"
            }`}
          >
            <div className="flex justify-between">
              <span>Preview Ekspektasi</span>
              <b>{formatRupiah(previewExpected ?? 0)}</b>
            </div>
            <div className="flex justify-between mt-0.5">
              <span>Preview Selisih</span>
              <b>
                {previewSelisih > 0 ? "+" : ""}
                {formatRupiah(previewSelisih)}
              </b>
            </div>
          </div>
        )}

        <div>
          <label className="text-xs font-bold block mb-1">Alasan (wajib)</label>
          <textarea
            value={alasan}
            onChange={(e) => setAlasan(e.target.value)}
            rows={2}
            placeholder="mis: typo 115 harusnya 115000"
            className="w-full px-3 py-2 border border-line rounded-md text-sm"
          />
        </div>

        {error && <div className="text-xs text-red-600">{error}</div>}

        <div className="flex justify-end gap-2 pt-2 border-t border-line">
          <button
            onClick={onClose}
            disabled={pending}
            className="px-4 py-2 border border-line rounded-md text-sm"
          >
            Batal
          </button>
          <button
            onClick={submit}
            disabled={pending}
            className="px-4 py-2 bg-amber-600 text-white rounded-md text-sm font-bold inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            {pending && <Loader2 size={14} className="animate-spin" />}
            Simpan
          </button>
        </div>
      </div>
    </div>
  );
}
