"use client";

import { useState, useTransition } from "react";
import { Check, X, ExternalLink, FileText } from "lucide-react";
import { konfirmasiBayar, tolakBayar } from "./actions";
import { formatRupiah } from "@/lib/utils";
import { normalizeDriveUrl, isPdfUrl } from "@/lib/drive-url";
import { DetailModal } from "@/components/DetailModal";

export type Row = {
  id: number;
  nomorOrder: string;
  total: number;
  metode: string | null;
  status: string; // statusBayar: belum | menunggu | lunas
  statusOrder: string;
  buktiUrl: string | null;
  bayarAt: string | null;
  diantarAt: string | null;
  createdAt: string;
  pelangganNama: string | null;
  pelangganTelp: string | null;
};

type Tab = "menunggu" | "piutang" | "lunas" | "all";

export function PembayaranClient({ rows }: { rows: Row[] }) {
  const [filter, setFilter] = useState<Tab>("menunggu");
  const [pending, startTransition] = useTransition();
  const [detailId, setDetailId] = useState<number | null>(null);

  // Piutang = order selesai tapi belum lunas
  function isPiutang(r: Row) {
    return r.statusOrder === "selesai" && r.status === "belum";
  }

  const filtered =
    filter === "all"
      ? rows
      : filter === "piutang"
        ? rows.filter(isPiutang)
        : rows.filter((r) => r.status === filter);

  const countMenunggu = rows.filter((r) => r.status === "menunggu").length;
  const countPiutang = rows.filter(isPiutang).length;

  return (
    <div className="space-y-4">
      <div className="flex gap-2 text-sm flex-wrap">
        {([
          { id: "menunggu", label: "Menunggu Verifikasi", count: countMenunggu },
          { id: "piutang", label: "Piutang", count: countPiutang },
          { id: "lunas", label: "Lunas", count: 0 },
          { id: "all", label: "Semua", count: 0 },
        ] as const).map((f) => {
          const isActive = filter === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id as Tab)}
              className={`px-3.5 py-1.5 rounded-full font-bold text-xs transition ${
                isActive
                  ? "bg-brand text-white"
                  : "bg-surface border border-line text-[color:var(--muted)] hover:text-ink"
              }`}
            >
              {f.label}
              {f.count > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 bg-[color:var(--accent2)] text-white rounded text-[10px]">
                  {f.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-2 gap-3">
        {filtered.map((r) => (
          <div
            key={r.id}
            className="bg-surface border border-line rounded-2xl p-4 space-y-3"
            style={{
              borderLeftWidth: 4,
              borderLeftColor:
                r.status === "lunas"
                  ? "#22C55E"
                  : isPiutang(r)
                    ? "#EF4444" // merah untuk piutang
                    : "var(--accent)",
            }}
          >
            <button
              type="button"
              onClick={() => setDetailId(r.id)}
              className="flex justify-between items-start gap-2 w-full text-left hover:opacity-80 transition"
            >
              <div className="min-w-0">
                <div className="font-mono text-xs text-[color:var(--muted)]">
                  {r.nomorOrder}
                </div>
                <div className="font-extrabold truncate">{r.pelangganNama ?? "-"}</div>
                {r.pelangganTelp && (
                  <div className="text-xs text-[color:var(--muted)]">{r.pelangganTelp}</div>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-lg font-extrabold text-brand">{formatRupiah(r.total)}</div>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    r.status === "lunas"
                      ? "bg-emerald-100 text-emerald-800"
                      : isPiutang(r)
                        ? "bg-red-100 text-red-800"
                        : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {(r.metode ?? "-").toUpperCase()} ·{" "}
                  {isPiutang(r) ? "PIUTANG" : r.status.toUpperCase()}
                </span>
                {r.diantarAt && r.statusOrder === "selesai" && (
                  <div className="text-[10px] text-[color:var(--muted)] mt-1">
                    Diantar:{" "}
                    {new Date(r.diantarAt).toLocaleDateString("id-ID", {
                      day: "2-digit",
                      month: "short",
                      timeZone: "Asia/Makassar",
                    })}
                  </div>
                )}
              </div>
            </button>

            {r.buktiUrl && (
              <div>
                <div className="text-[10px] text-[color:var(--muted)] mb-1.5 font-semibold uppercase tracking-wide">
                  Bukti Pembayaran
                </div>
                {isPdfUrl(r.buktiUrl) ? (
                  <a
                    href={r.buktiUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block w-full p-6 rounded-xl border border-line bg-[color:var(--surface2)] text-center hover:border-brand transition"
                  >
                    <FileText size={32} className="mx-auto mb-2 text-brand" />
                    <div className="text-sm font-bold text-ink">Bukti PDF</div>
                    <div className="text-xs text-[color:var(--muted)]">Klik untuk buka</div>
                  </a>
                ) : (
                  <a href={r.buktiUrl} target="_blank" rel="noreferrer" className="block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={normalizeDriveUrl(r.buktiUrl)}
                      alt="Bukti"
                      className="w-full max-h-64 object-contain rounded-xl border border-line bg-[color:var(--surface2)]"
                    />
                  </a>
                )}
                <a
                  href={r.buktiUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-brand font-bold inline-flex items-center gap-1 mt-2"
                >
                  <ExternalLink size={11} /> Buka di tab baru
                </a>
              </div>
            )}

            {(r.status === "menunggu" || isPiutang(r)) && (
              <div className="flex gap-2 pt-3 border-t border-line">
                <button
                  disabled={pending}
                  onClick={() => {
                    let msg: string;
                    if (isPiutang(r)) {
                      msg = r.buktiUrl
                        ? `⚠ MOHON PERIKSA BUKTI PEMBAYARAN dulu di card ini sebelum menandai lunas.\n\nTandai LUNAS piutang ${r.nomorOrder} (${formatRupiah(r.total)})?`
                        : `ℹ BELUM ADA BUKTI PEMBAYARAN dari pelanggan.\n\nLanjut tandai LUNAS piutang ${r.nomorOrder} (${formatRupiah(r.total)})? Pastikan pelanggan sudah benar-benar bayar.`;
                    } else {
                      msg = `⚠ MOHON PERIKSA BUKTI PEMBAYARAN dulu di card ini sebelum konfirmasi.\n\nKonfirmasi pembayaran ${r.nomorOrder} sebesar ${formatRupiah(r.total)}?`;
                    }
                    if (confirm(msg)) {
                      startTransition(async () => {
                        await konfirmasiBayar(r.id);
                      });
                    }
                  }}
                  className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-extrabold inline-flex items-center justify-center gap-1.5 disabled:opacity-50 active:scale-[0.98] transition"
                >
                  <Check size={14} /> {isPiutang(r) ? "Tandai Lunas" : "Konfirmasi Lunas"}
                </button>
                {/* Tombol tolak hanya untuk yang punya bukti (statusBayar=menunggu) */}
                {r.status === "menunggu" && (
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
                    className="px-3 py-2.5 border-2 border-rose-200 text-rose-600 rounded-xl text-sm font-bold inline-flex items-center justify-center gap-1 disabled:opacity-50"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            )}

            {r.status === "lunas" && r.bayarAt && (
              <div className="text-[11px] text-[color:var(--muted)] pt-3 border-t border-line">
                ✓ Lunas{" "}
                {new Date(r.bayarAt).toLocaleString("id-ID", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="lg:col-span-2 p-10 text-center text-[color:var(--muted)] bg-surface rounded-2xl border border-line">
            Tidak ada data.
          </div>
        )}
      </div>

      {detailId !== null && (
        <DetailModal kind="order" id={detailId} onClose={() => setDetailId(null)} />
      )}
    </div>
  );
}
