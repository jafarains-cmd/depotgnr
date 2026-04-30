"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { cancelOrderByPelanggan } from "./actions";

export function CancelOrderButton({
  orderId,
  nomorOrder,
}: {
  orderId: number;
  nomorOrder: string;
}) {
  const [open, setOpen] = useState(false);
  const [alasan, setAlasan] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleCancel() {
    setError(null);
    startTransition(async () => {
      const r = await cancelOrderByPelanggan(orderId, alasan.trim() || undefined);
      if (r.ok) {
        setOpen(false);
        setAlasan("");
      } else {
        setError(r.error ?? "Gagal");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-red-600 hover:text-red-700 inline-flex items-center gap-1 px-2 py-1 border border-red-200 rounded hover:bg-red-50"
      >
        <X size={12} /> Batalkan
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-xl w-full max-w-sm p-5 space-y-3">
            <div>
              <h2 className="font-semibold text-lg">Batalkan Order?</h2>
              <p className="text-sm text-[color:var(--muted)] mt-1">
                Order <span className="font-mono">{nomorOrder}</span> akan dibatalkan. Aksi ini
                tidak bisa di-undo.
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-[color:var(--muted)] mb-1">
                Alasan (opsional)
              </label>
              <textarea
                value={alasan}
                onChange={(e) => setAlasan(e.target.value)}
                rows={2}
                placeholder="Mis. salah qty, salah alamat, ganti pikiran"
                className="w-full px-3 py-2 border border-line rounded-md text-sm"
              />
            </div>
            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 p-2 rounded">
                {error}
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setError(null);
                }}
                className="px-4 py-2 text-sm text-[color:var(--muted)]"
              >
                Tidak jadi
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={handleCancel}
                className="px-4 py-2 bg-red-600 text-white text-sm rounded-md disabled:opacity-50"
              >
                {pending ? "Membatalkan..." : "Ya, Batalkan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
