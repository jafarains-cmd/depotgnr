"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock, X, Loader2 } from "lucide-react";
import { forceCloseShiftAction } from "@/app/kasir/shift/actions";
import { formatRupiah } from "@/lib/utils";

export function ForceCloseButton({
  shiftId,
  kasirNama,
  expectedCash,
}: {
  shiftId: number;
  kasirNama: string;
  expectedCash: number;
}) {
  const [open, setOpen] = useState(false);
  const [counted, setCounted] = useState("0");
  const [alasan, setAlasan] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const countedNum = Math.max(0, Math.floor(Number(counted) || 0));
  const selisih = countedNum - expectedCash;

  function submit() {
    setError(null);
    if (alasan.trim().length < 3) {
      setError("Alasan wajib (min 3 karakter)");
      return;
    }
    startTransition(async () => {
      const r = await forceCloseShiftAction({
        shiftId,
        closingCashCounted: countedNum,
        alasan,
      });
      if ("error" in r) setError(r.error);
      else {
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-2 py-1 text-[10px] bg-red-600 text-white rounded-md font-bold inline-flex items-center gap-1 hover:bg-red-700"
        title="Force close shift kasir lain (admin)"
      >
        <Lock size={10} /> Force Close
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 grid place-items-center p-4">
          <div className="bg-surface rounded-2xl max-w-md w-full p-5 space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="font-bold text-lg inline-flex items-center gap-1.5 text-red-700">
                  <Lock size={18} /> Force Close Shift
                </h2>
                <div className="text-xs text-[color:var(--muted)] mt-0.5">
                  Kasir: {kasirNama}
                </div>
              </div>
              <button onClick={() => setOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">
              ⚠ Anda menutup shift kasir LAIN (atas nama admin). Audit log akan
              mencatat aksi ini. Pakai kalau kasir lupa tutup / resign / tidak
              bisa dihubungi.
            </div>

            <div className="bg-[color:var(--surface2)] rounded-lg p-2 text-xs">
              <div className="flex justify-between">
                <span className="text-[color:var(--muted)]">Ekspektasi cash</span>
                <b>{formatRupiah(expectedCash)}</b>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold block mb-1">
                Uang Fisik (input 0 kalau tidak tahu)
              </label>
              <input
                type="number"
                min={0}
                value={counted}
                onChange={(e) => setCounted(e.target.value)}
                className="w-full px-3 py-2 border border-line rounded-md text-lg font-mono"
              />
              <div
                className={`mt-1 text-[11px] font-bold ${
                  selisih === 0
                    ? "text-[color:var(--muted)]"
                    : selisih > 0
                      ? "text-emerald-700"
                      : "text-red-600"
                }`}
              >
                Selisih: {selisih > 0 ? "+" : ""}
                {formatRupiah(selisih)}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold block mb-1">Alasan (wajib)</label>
              <textarea
                value={alasan}
                onChange={(e) => setAlasan(e.target.value)}
                rows={2}
                placeholder="mis: kasir lupa tutup kemarin, sudah dikonfirmasi via WA"
                className="w-full px-3 py-2 border border-line rounded-md text-sm"
              />
            </div>

            {error && <div className="text-xs text-red-600">{error}</div>}

            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <button
                onClick={() => setOpen(false)}
                disabled={pending}
                className="px-4 py-2 border border-line rounded-md text-sm"
              >
                Batal
              </button>
              <button
                onClick={submit}
                disabled={pending}
                className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-bold inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                {pending && <Loader2 size={14} className="animate-spin" />}
                Force Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
