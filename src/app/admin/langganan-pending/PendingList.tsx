"use client";

import { useState, useTransition } from "react";
import { BadgeCheck, X, Phone, MapPin, Clock } from "lucide-react";
import { verifyLangganan, rejectLangganan } from "./actions";
import { useToast } from "@/components/Toast";
import { normalizeDriveUrl } from "@/lib/drive-url";

type Row = {
  id: number;
  nama: string;
  telp: string | null;
  alamat: string | null;
  ktpFotoUrl: string | null;
  ktpUploadedAt: Date | null;
};

export function PendingList({ rows }: { rows: Row[] }) {
  if (rows.length === 0) {
    return (
      <div className="bg-surface border border-line rounded-2xl p-8 text-center">
        <BadgeCheck size={40} className="mx-auto text-emerald-500 mb-3" />
        <div className="font-bold">Tidak ada pengajuan pending</div>
        <p className="text-sm text-[color:var(--muted)] mt-1">
          Semua permohonan langganan sudah diproses.
        </p>
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-2 gap-3">
      {rows.map((r) => (
        <PendingCard key={r.id} row={r} />
      ))}
    </div>
  );
}

function PendingCard({ row }: { row: Row }) {
  const [rejectMode, setRejectMode] = useState(false);
  const [alasan, setAlasan] = useState("");
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  const ktpUrl = normalizeDriveUrl(row.ktpFotoUrl);

  function onVerify() {
    startTransition(async () => {
      const res = await verifyLangganan(row.id);
      if (res.ok) toast.success(`${row.nama} disetujui sebagai langganan`);
      else toast.error(res.error);
    });
  }

  function onReject() {
    startTransition(async () => {
      const res = await rejectLangganan(row.id, alasan);
      if (res.ok) toast.success(`Pengajuan ${row.nama} ditolak`);
      else toast.error(res.error);
    });
  }

  return (
    <div className="bg-surface border border-line rounded-2xl overflow-hidden">
      {ktpUrl ? (
        <a href={ktpUrl} target="_blank" rel="noreferrer" className="block bg-slate-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={ktpUrl}
            alt={`KTP ${row.nama}`}
            className="w-full h-48 object-contain"
            referrerPolicy="no-referrer"
          />
        </a>
      ) : (
        <div className="w-full h-48 bg-slate-100 grid place-items-center text-sm text-[color:var(--muted)]">
          Tidak ada foto KTP
        </div>
      )}

      <div className="p-3 space-y-2">
        <div>
          <div className="font-bold text-sm">{row.nama}</div>
          {row.telp && (
            <div className="text-xs text-[color:var(--muted)] inline-flex items-center gap-1">
              <Phone size={11} /> {row.telp}
            </div>
          )}
          {row.alamat && (
            <div className="text-xs text-[color:var(--muted)] inline-flex items-start gap-1 mt-0.5">
              <MapPin size={11} className="mt-0.5 flex-shrink-0" />
              <span className="line-clamp-2">{row.alamat}</span>
            </div>
          )}
          {row.ktpUploadedAt && (
            <div className="text-[11px] text-[color:var(--muted)] inline-flex items-center gap-1 mt-1">
              <Clock size={10} />
              Upload {row.ktpUploadedAt.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
            </div>
          )}
        </div>

        {rejectMode ? (
          <div className="space-y-2">
            <textarea
              value={alasan}
              onChange={(e) => setAlasan(e.target.value)}
              placeholder="Alasan penolakan (akan dikirim ke pelanggan via WA)"
              className="w-full px-2 py-1.5 border border-line rounded-lg text-sm resize-none"
              rows={2}
            />
            <div className="flex gap-2">
              <button
                onClick={onReject}
                disabled={pending || alasan.trim().length < 5}
                className="flex-1 py-2 bg-rose-600 text-white text-xs font-bold rounded-lg disabled:opacity-50"
              >
                {pending ? "..." : "Konfirmasi Tolak"}
              </button>
              <button
                onClick={() => {
                  setRejectMode(false);
                  setAlasan("");
                }}
                disabled={pending}
                className="px-3 py-2 border border-line text-xs font-bold rounded-lg"
              >
                Batal
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={onVerify}
              disabled={pending}
              className="flex-1 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 transition disabled:opacity-50 inline-flex items-center justify-center gap-1"
            >
              <BadgeCheck size={14} /> Verify
            </button>
            <button
              onClick={() => setRejectMode(true)}
              disabled={pending}
              className="flex-1 py-2 bg-rose-100 text-rose-700 text-xs font-bold rounded-lg hover:bg-rose-200 transition inline-flex items-center justify-center gap-1"
            >
              <X size={14} /> Tolak
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
