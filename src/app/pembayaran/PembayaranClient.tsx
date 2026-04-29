"use client";

import { useState, useTransition } from "react";
import { Check, X, ExternalLink } from "lucide-react";
import { konfirmasiBayar, tolakBayar } from "./actions";
import { formatRupiah } from "@/lib/utils";

export type Row = {
  id: number;
  nomorOrder: string;
  total: number;
  metode: string | null;
  status: string;
  buktiUrl: string | null;
  bayarAt: string | null;
  createdAt: string;
  pelangganNama: string | null;
  pelangganTelp: string | null;
};

export function PembayaranClient({ rows }: { rows: Row[] }) {
  const [filter, setFilter] = useState<"menunggu" | "lunas" | "all">("menunggu");
  const [pending, startTransition] = useTransition();

  const filtered = filter === "all" ? rows : rows.filter((r) => r.status === filter);

  return (
    <div className="space-y-4">
      <div className="flex gap-1 text-sm">
        {(["menunggu", "lunas", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-md ${
              filter === f ? "bg-brand-600 text-white" : "bg-white border border-slate-200"
            }`}
          >
            {f === "all" ? "Semua" : f === "menunggu" ? "Menunggu Verifikasi" : "Sudah Lunas"}
            {f === "menunggu" && rows.filter((r) => r.status === "menunggu").length > 0 && (
              <span className="ml-1.5 px-1.5 py-0 bg-amber-200 text-amber-900 rounded text-[10px]">
                {rows.filter((r) => r.status === "menunggu").length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-3">
        {filtered.map((r) => (
          <div key={r.id} className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-mono text-xs text-slate-500">{r.nomorOrder}</div>
                <div className="font-medium">{r.pelangganNama ?? "-"}</div>
                {r.pelangganTelp && (
                  <div className="text-xs text-slate-500">{r.pelangganTelp}</div>
                )}
              </div>
              <div className="text-right">
                <div className="text-lg font-bold">{formatRupiah(r.total)}</div>
                <span
                  className={`text-xs px-2 py-0.5 rounded ${
                    r.status === "lunas"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {(r.metode ?? "-").toUpperCase()} · {r.status}
                </span>
              </div>
            </div>

            {r.buktiUrl && (
              <div>
                <div className="text-xs text-slate-500 mb-1">Bukti Pembayaran:</div>
                <a href={r.buktiUrl} target="_blank" rel="noreferrer" className="block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={r.buktiUrl}
                    alt="Bukti"
                    className="w-full max-h-64 object-contain rounded-md border border-slate-200 bg-slate-50"
                  />
                </a>
                <a
                  href={r.buktiUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-brand-600 inline-flex items-center gap-1 mt-1"
                >
                  <ExternalLink size={11} /> Buka di tab baru
                </a>
              </div>
            )}

            {r.status === "menunggu" && (
              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button
                  disabled={pending}
                  onClick={() => {
                    if (confirm(`Konfirmasi pembayaran ${r.nomorOrder} sebesar ${formatRupiah(r.total)}?`)) {
                      startTransition(async () => {
                        await konfirmasiBayar(r.id);
                      });
                    }
                  }}
                  className="flex-1 py-2 bg-emerald-600 text-white rounded-md text-sm font-medium inline-flex items-center justify-center gap-1 disabled:opacity-50"
                >
                  <Check size={14} /> Konfirmasi Lunas
                </button>
                <button
                  disabled={pending}
                  onClick={() => {
                    const alasan = prompt("Alasan tolak (opsional):") ?? "";
                    if (confirm(`Tolak bukti pembayaran ${r.nomorOrder}?`)) {
                      startTransition(async () => {
                        await tolakBayar(r.id, alasan);
                      });
                    }
                  }}
                  className="px-3 py-2 border border-red-200 text-red-600 rounded-md text-sm inline-flex items-center justify-center gap-1 disabled:opacity-50"
                >
                  <X size={14} /> Tolak
                </button>
              </div>
            )}

            {r.status === "lunas" && r.bayarAt && (
              <div className="text-xs text-slate-500 pt-2 border-t border-slate-100">
                Lunas:{" "}
                {new Date(r.bayarAt).toLocaleString("id-ID", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="lg:col-span-2 p-8 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
            Tidak ada data.
          </div>
        )}
      </div>
    </div>
  );
}
