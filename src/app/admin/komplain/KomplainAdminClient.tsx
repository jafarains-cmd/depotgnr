"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  ExternalLink,
  Phone,
} from "lucide-react";
import { resolveKomplain } from "./actions";
import { useFormatTanggal } from "@/components/TimezoneContext";
import { formatRupiah } from "@/lib/utils";
import { normalizeDriveUrl } from "@/lib/drive-url";

const JENIS_LABEL: Record<string, string> = {
  kotor: "Galon kotor / kemasan rusak",
  rusak: "Air berbau / rasa aneh",
  kurang_volume: "Volume kurang",
  salah_pesanan: "Pesanan tidak sesuai",
  lainnya: "Lainnya",
};

const STATUS_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  baru: { bg: "bg-amber-50", fg: "text-amber-700", label: "BARU" },
  diproses: { bg: "bg-blue-50", fg: "text-blue-700", label: "DIPROSES" },
  selesai: { bg: "bg-emerald-50", fg: "text-emerald-700", label: "SELESAI" },
  ditolak: { bg: "bg-rose-50", fg: "text-rose-700", label: "DITOLAK" },
};

export type Row = {
  id: number;
  pelangganId: number;
  pelangganNama: string;
  pelangganTelp: string | null;
  refOrderId: number | null;
  jenis: string;
  deskripsi: string;
  fotoUrl: string | null;
  status: string;
  resolusi: string | null;
  kompensasiLoyalti: number;
  createdAt: string;
  resolvedAt: string | null;
  resolvedByName: string | null;
};

export function KomplainAdminClient({ rows }: { rows: Row[] }) {
  const fmt = useFormatTanggal();
  const [resolveFor, setResolveFor] = useState<Row | null>(null);

  if (rows.length === 0) {
    return (
      <div className="bg-surface border border-line rounded-2xl p-8 text-center text-sm text-[color:var(--muted)]">
        Tidak ada komplain di filter ini.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((k) => {
        const style = STATUS_STYLE[k.status] ?? STATUS_STYLE.baru;
        const closed = k.status === "selesai" || k.status === "ditolak";
        return (
          <div
            key={k.id}
            className="bg-surface border border-line rounded-2xl p-4 space-y-2"
          >
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div className="min-w-0">
                <div className="font-mono text-[11px] text-[color:var(--muted)]">
                  #{k.id} · {fmt(k.createdAt, { dateStyle: "medium", timeStyle: "short" })}
                </div>
                <div className="font-bold text-base">
                  <Link
                    href={`/data-pelanggan/${k.pelangganId}`}
                    className="hover:text-brand hover:underline"
                  >
                    {k.pelangganNama}
                  </Link>
                </div>
                <div className="text-xs text-[color:var(--muted)] inline-flex items-center gap-3">
                  {k.pelangganTelp && (
                    <span className="inline-flex items-center gap-1">
                      <Phone size={11} /> {k.pelangganTelp}
                    </span>
                  )}
                  {k.refOrderId && (
                    <span>
                      Order:{" "}
                      <Link
                        href={`/kasir/order`}
                        className="text-brand hover:underline"
                      >
                        #{k.refOrderId}
                      </Link>
                    </span>
                  )}
                </div>
              </div>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${style.bg} ${style.fg}`}
              >
                {style.label}
              </span>
            </div>

            <div className="bg-[color:var(--surface2)] rounded-md p-3">
              <div className="text-xs font-bold text-[color:var(--muted)] uppercase tracking-wide mb-1">
                {JENIS_LABEL[k.jenis] ?? k.jenis}
              </div>
              <div className="text-sm whitespace-pre-wrap">{k.deskripsi}</div>
            </div>

            {k.fotoUrl && (
              <a href={k.fotoUrl} target="_blank" rel="noreferrer" className="block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={normalizeDriveUrl(k.fotoUrl)}
                  alt="Foto"
                  className="w-full max-h-64 object-contain rounded-md border border-line bg-[color:var(--surface2)]"
                />
                <span className="text-[10px] text-brand inline-flex items-center gap-1 mt-1">
                  <ExternalLink size={10} /> Buka foto
                </span>
              </a>
            )}

            {closed && k.resolusi && (
              <div className={`${style.bg} rounded-md p-3 text-xs`}>
                <div className={`font-bold mb-1 ${style.fg}`}>
                  Tanggapan ({k.resolvedByName ?? "admin"}):
                </div>
                <div className="whitespace-pre-wrap text-ink">{k.resolusi}</div>
                {k.kompensasiLoyalti > 0 && (
                  <div className="mt-2 font-bold text-emerald-700">
                    Kompensasi: +{formatRupiah(k.kompensasiLoyalti)} loyalty
                  </div>
                )}
                {k.resolvedAt && (
                  <div className="mt-1 text-[10px] text-[color:var(--muted)]">
                    {fmt(k.resolvedAt, { dateStyle: "medium", timeStyle: "short" })}
                  </div>
                )}
              </div>
            )}

            <div className="pt-2 border-t border-line flex gap-2 flex-wrap">
              <Link
                href={`/komplain/${k.id}`}
                className="px-3 py-1.5 bg-violet-100 text-violet-800 rounded-md text-xs font-bold inline-flex items-center gap-1"
              >
                💬 Chat
              </Link>
              {!closed && (
                <button
                  onClick={() => setResolveFor(k)}
                  className="px-3 py-1.5 bg-brand-600 text-white rounded-md text-xs font-bold"
                >
                  Tindak Lanjuti
                </button>
              )}
            </div>
          </div>
        );
      })}

      {resolveFor && (
        <ResolveModal
          komplain={resolveFor}
          onClose={() => setResolveFor(null)}
        />
      )}
    </div>
  );
}

function ResolveModal({
  komplain,
  onClose,
}: {
  komplain: Row;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"diproses" | "selesai" | "ditolak">("selesai");
  const [resolusi, setResolusi] = useState("");
  const [kompensasi, setKompensasi] = useState("");

  function submit() {
    setError(null);
    const k = kompensasi ? parseInt(kompensasi.replace(/[^0-9]/g, ""), 10) : 0;
    if (status === "ditolak" && !resolusi.trim()) {
      setError("Alasan penolakan wajib diisi");
      return;
    }
    startTransition(async () => {
      const r = await resolveKomplain({
        id: komplain.id,
        status,
        resolusi,
        kompensasiLoyalti: k,
      });
      if ("error" in r) setError(r.error);
      else {
        onClose();
        router.refresh();
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-line">
          <h2 className="font-bold">Tindak Lanjuti #{komplain.id}</h2>
          <button onClick={onClose} className="text-[color:var(--muted)]">
            <XCircle size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="text-xs">
            <div className="text-[color:var(--muted)]">Pelanggan</div>
            <div className="font-bold">{komplain.pelangganNama}</div>
          </div>

          <div>
            <label className="text-xs font-medium block mb-1">Status</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setStatus("diproses")}
                className={`py-2 text-xs rounded-md border inline-flex items-center justify-center gap-1 ${
                  status === "diproses"
                    ? "bg-blue-600 text-white border-blue-600"
                    : "border-line"
                }`}
              >
                <Clock size={12} /> Diproses
              </button>
              <button
                type="button"
                onClick={() => setStatus("selesai")}
                className={`py-2 text-xs rounded-md border inline-flex items-center justify-center gap-1 ${
                  status === "selesai"
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "border-line"
                }`}
              >
                <CheckCircle size={12} /> Selesai
              </button>
              <button
                type="button"
                onClick={() => setStatus("ditolak")}
                className={`py-2 text-xs rounded-md border inline-flex items-center justify-center gap-1 ${
                  status === "ditolak"
                    ? "bg-rose-600 text-white border-rose-600"
                    : "border-line"
                }`}
              >
                <XCircle size={12} /> Tolak
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium block mb-1">
              Tanggapan / Resolusi{" "}
              {status === "ditolak" && (
                <span className="text-rose-600">(wajib)</span>
              )}
            </label>
            <textarea
              value={resolusi}
              onChange={(e) => setResolusi(e.target.value)}
              rows={4}
              placeholder="Mis: Sudah kami ganti galon baru. Maaf atas ketidaknyamanan."
              className="w-full px-3 py-2 border border-line rounded-md text-sm"
            />
          </div>

          {status === "selesai" && (
            <div>
              <label className="text-xs font-medium block mb-1">
                Kompensasi Loyalty (Rp, opsional)
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={kompensasi}
                onChange={(e) => setKompensasi(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="5000"
                className="w-full px-3 py-2 border border-line rounded-md text-sm font-mono"
              />
              <div className="text-[10px] text-[color:var(--muted)] mt-0.5">
                Akan masuk ke saldo loyalty pelanggan langsung.
              </div>
            </div>
          )}

          {error && <div className="text-xs text-rose-600">{error}</div>}
        </div>
        <div className="px-4 py-3 border-t border-line flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-line rounded-md text-sm"
          >
            Batal
          </button>
          <button
            onClick={submit}
            disabled={pending}
            className="px-4 py-2 bg-brand-600 text-white rounded-md text-sm font-bold inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            {pending && <Loader2 size={14} className="animate-spin" />}
            Simpan
          </button>
        </div>
      </div>
    </div>
  );
}
