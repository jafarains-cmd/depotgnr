"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { tarikKomplain } from "./actions";
import { useFormatTanggal } from "@/components/TimezoneContext";
import { formatRupiah } from "@/lib/utils";
import { normalizeDriveUrl } from "@/lib/drive-url";

const JENIS_LABEL: Record<string, string> = {
  kotor: "Galon kotor / kemasan rusak",
  rusak: "Air berbau / rasa aneh",
  kurang_volume: "Volume kurang dari standar",
  salah_pesanan: "Pesanan tidak sesuai",
  lainnya: "Lainnya",
};

const STATUS_STYLE: Record<
  string,
  { bg: string; fg: string; label: string; icon: React.ReactNode }
> = {
  baru: {
    bg: "bg-amber-50",
    fg: "text-amber-700",
    label: "Menunggu Tanggapan",
    icon: <Clock size={12} />,
  },
  diproses: {
    bg: "bg-blue-50",
    fg: "text-blue-700",
    label: "Sedang Diproses",
    icon: <Loader2 size={12} className="animate-spin" />,
  },
  selesai: {
    bg: "bg-emerald-50",
    fg: "text-emerald-700",
    label: "Selesai",
    icon: <CheckCircle size={12} />,
  },
  ditolak: {
    bg: "bg-rose-50",
    fg: "text-rose-700",
    label: "Ditolak",
    icon: <XCircle size={12} />,
  },
};

export type KomplainRow = {
  id: number;
  jenis: string;
  deskripsi: string;
  fotoUrl: string | null;
  status: string;
  resolusi: string | null;
  kompensasiLoyalti: number;
  refOrderId: number | null;
  createdAt: string;
  resolvedAt: string | null;
};

export function KomplainList({ rows }: { rows: KomplainRow[] }) {
  const fmt = useFormatTanggal();

  if (rows.length === 0) {
    return (
      <div className="bg-surface border border-line rounded-2xl p-8 text-center text-sm text-[color:var(--muted)]">
        Belum ada komplain. Klik "Komplain Baru" kalau ada masalah dengan produk
        atau order.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((k) => {
        const style = STATUS_STYLE[k.status] ?? STATUS_STYLE.baru;
        return (
          <div
            key={k.id}
            className="bg-surface border border-line rounded-2xl p-4 space-y-2"
          >
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <div className="font-mono text-[11px] text-[color:var(--muted)]">
                  #{k.id} · {fmt(k.createdAt, { dateStyle: "medium", timeStyle: "short" })}
                </div>
                <div className="font-bold text-sm mt-0.5">
                  {JENIS_LABEL[k.jenis] ?? k.jenis}
                </div>
              </div>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold inline-flex items-center gap-1 ${style.bg} ${style.fg}`}
              >
                {style.icon}
                {style.label}
              </span>
            </div>

            <div className="text-sm text-ink whitespace-pre-wrap">{k.deskripsi}</div>

            {k.refOrderId && (
              <div className="text-xs text-[color:var(--muted)]">
                Terkait order #{k.refOrderId}
              </div>
            )}

            {k.fotoUrl && (
              <a
                href={k.fotoUrl}
                target="_blank"
                rel="noreferrer"
                className="block"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={normalizeDriveUrl(k.fotoUrl)}
                  alt="Foto komplain"
                  className="w-full max-h-48 object-cover rounded-md border border-line"
                />
                <span className="text-[10px] text-brand inline-flex items-center gap-1 mt-1">
                  <ExternalLink size={10} /> Buka foto
                </span>
              </a>
            )}

            {(k.status === "selesai" || k.status === "ditolak") && k.resolusi && (
              <div className={`${style.bg} rounded-md p-3 text-xs ${style.fg}`}>
                <div className="font-bold mb-1">Tanggapan Admin:</div>
                <div className="whitespace-pre-wrap text-ink">{k.resolusi}</div>
                {k.kompensasiLoyalti > 0 && (
                  <div className="mt-2 font-bold">
                    💰 Kompensasi: +{formatRupiah(k.kompensasiLoyalti)} saldo loyalty
                  </div>
                )}
              </div>
            )}

            <div className="pt-2 border-t border-line flex gap-2">
              <Link
                href={`/komplain/${k.id}`}
                className="flex-1 py-2 bg-violet-100 text-violet-800 rounded-md text-xs font-bold inline-flex items-center justify-center gap-1"
              >
                💬 Chat dengan Admin
              </Link>
              {k.status === "baru" && <TarikButton id={k.id} />}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TarikButton({ id }: { id: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      onClick={() => {
        if (!confirm("Tarik komplain ini? Tidak bisa di-undo.")) return;
        startTransition(async () => {
          const r = await tarikKomplain(id);
          if ("ok" in r) router.refresh();
        });
      }}
      disabled={pending}
      className="text-xs text-rose-600 hover:opacity-70 inline-flex items-center gap-1 disabled:opacity-40"
    >
      <Trash2 size={11} /> Tarik komplain
    </button>
  );
}
