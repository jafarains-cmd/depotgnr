"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Ban } from "lucide-react";
import { batalkanTransaksi } from "./actions";

export function BatalkanCard({
  trxId,
  ageDays,
}: {
  trxId: number;
  ageDays: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [alasan, setAlasan] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const overAge = ageDays > 30;
  const sisaHari = Math.max(0, 30 - ageDays);

  if (msg?.ok) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center">
        <div className="text-emerald-700 font-bold">{msg.text}</div>
      </div>
    );
  }

  return (
    <div className="bg-rose-50/50 border-2 border-rose-200 rounded-2xl overflow-hidden">
      <div className="bg-rose-100 px-4 py-2.5 inline-flex items-center gap-2 w-full border-b border-rose-200">
        <AlertTriangle size={16} className="text-rose-700" />
        <span className="text-xs font-extrabold tracking-widest text-rose-800">
          ZONA BAHAYA · ADMIN ONLY
        </span>
      </div>

      <div className="p-4 space-y-3">
        <div>
          <div className="font-bold text-rose-900">Batalkan Transaksi</div>
          <div className="text-xs text-rose-700 mt-1">
            Loyalty pelanggan akan dikurangi, stok galon dikembalikan, dan
            transaksi ditandai BATAL di laporan. Tindakan ini{" "}
            <b>tidak bisa di-undo</b>.
          </div>
          {!overAge && (
            <div className="text-[11px] text-rose-600 mt-1">
              ℹ Hanya bisa dibatalkan dalam 30 hari sejak transaksi dibuat.
              {sisaHari < 7 && sisaHari > 0 && (
                <b> Sisa {sisaHari} hari.</b>
              )}
            </div>
          )}
        </div>

        {overAge ? (
          <div className="bg-rose-100 border border-rose-200 rounded-md p-3 text-xs text-rose-700">
            ⚠ Transaksi sudah berusia <b>{ageDays} hari</b> (lebih dari 30 hari).
            Tidak bisa dibatalkan otomatis. Hubungi developer kalau benar-benar
            perlu koreksi.
          </div>
        ) : !showForm ? (
          <button
            onClick={() => setShowForm(true)}
            className="w-full py-2.5 bg-white border-2 border-rose-300 text-rose-700 rounded-xl text-sm font-bold inline-flex items-center justify-center gap-1.5 hover:bg-rose-50 transition"
          >
            <Ban size={14} /> Mulai Pembatalan
          </button>
        ) : (
          <div className="space-y-2">
            <label className="block text-xs font-bold text-rose-800">
              Alasan pembatalan <span className="text-rose-600">*</span>
            </label>
            <textarea
              value={alasan}
              onChange={(e) => setAlasan(e.target.value)}
              placeholder="Contoh: salah input qty, pelanggan minta refund, double-charge…"
              rows={3}
              className="w-full px-3 py-2 border border-rose-300 rounded-md text-sm bg-white"
            />
            <div className="text-[10px] text-rose-600">
              Minimal 3 karakter. Catatan ini disimpan permanen di history.
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  setShowForm(false);
                  setAlasan("");
                  setMsg(null);
                }}
                disabled={pending}
                className="py-2 border border-line rounded-md text-sm"
              >
                Kembali
              </button>
              <button
                onClick={() => {
                  if (!confirm(`Yakin batalkan transaksi ini?\n\nAlasan: ${alasan.trim()}`)) return;
                  setMsg(null);
                  startTransition(async () => {
                    const r = await batalkanTransaksi(trxId, alasan);
                    if ("error" in r) {
                      setMsg({ ok: false, text: r.error });
                    } else {
                      setMsg({ ok: true, text: "✓ Transaksi berhasil dibatalkan." });
                      setTimeout(() => router.refresh(), 800);
                    }
                  });
                }}
                disabled={pending || alasan.trim().length < 3}
                className="py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-sm font-bold disabled:opacity-50 transition"
              >
                {pending ? "Memproses..." : "Konfirmasi Batalkan"}
              </button>
            </div>
          </div>
        )}

        {msg && !msg.ok && (
          <div className="text-xs text-rose-700 bg-rose-100 rounded p-2">
            ❌ {msg.text}
          </div>
        )}
      </div>
    </div>
  );
}
