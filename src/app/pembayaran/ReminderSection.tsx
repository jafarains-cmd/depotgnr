"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  MessageSquare,
  ExternalLink,
  Check,
  X,
  AlertTriangle,
  Loader2,
  History,
} from "lucide-react";
import { markReminderSent, skipReminderStage } from "./reminder-actions";
import { formatRupiah } from "@/lib/utils";

export type ReminderRow = {
  orderId: number;
  nomorOrder: string;
  pelangganNama: string;
  pelangganTelp: string | null;
  totalPiutang: number;
  daysAge: number;
  currentStage: 1 | 2 | 3;
  lastReminderStage: 1 | 2 | 3 | null;
  waLink: string | null;
};

const STAGE_LABEL: Record<1 | 2 | 3, { text: string; color: string }> = {
  1: { text: "H+7 Sopan", color: "bg-sky-100 text-sky-800 border-sky-300" },
  2: { text: "H+14 Tegas", color: "bg-amber-100 text-amber-800 border-amber-300" },
  3: { text: "H+30 Terakhir", color: "bg-red-100 text-red-800 border-red-300" },
};

export function ReminderSection({ rows }: { rows: ReminderRow[] }) {
  if (rows.length === 0) return null;

  const totalNilai = rows.reduce((s, r) => s + r.totalPiutang, 0);

  return (
    <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <h2 className="font-extrabold text-base inline-flex items-center gap-1.5 text-amber-900">
            <MessageSquare size={18} /> Perlu Kirim WA — {rows.length} Piutang
          </h2>
          <div className="text-xs text-amber-800 mt-0.5">
            Total nilai: <b>{formatRupiah(totalNilai)}</b> · Klik tombol
            &quot;Kirim WA&quot; untuk buka WhatsApp dengan pesan siap kirim.
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {rows.map((r) => (
          <ReminderCard key={r.orderId} row={r} />
        ))}
      </div>
    </div>
  );
}

function ReminderCard({ row }: { row: ReminderRow }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showSkip, setShowSkip] = useState(false);
  const [skipAlasan, setSkipAlasan] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [waOpened, setWaOpened] = useState(false);

  function handleOpenWa() {
    if (!row.waLink) return;
    window.open(row.waLink, "_blank", "noopener,noreferrer");
    setWaOpened(true);
  }

  function handleMarkSent() {
    setErr(null);
    startTransition(async () => {
      const res = await markReminderSent({
        orderId: row.orderId,
        stage: row.currentStage,
      });
      if ("error" in res) {
        setErr(res.error);
        return;
      }
      router.refresh();
    });
  }

  function handleSkip() {
    setErr(null);
    if (skipAlasan.trim().length < 3) {
      setErr("Alasan wajib (min 3 karakter)");
      return;
    }
    startTransition(async () => {
      const res = await skipReminderStage({
        orderId: row.orderId,
        stage: row.currentStage,
        alasan: skipAlasan.trim(),
      });
      if ("error" in res) {
        setErr(res.error);
        return;
      }
      setShowSkip(false);
      router.refresh();
    });
  }

  const stage = STAGE_LABEL[row.currentStage];
  const notelpValid = !!row.waLink;

  return (
    <div className="bg-surface border border-amber-200 rounded-lg p-3">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="inline-flex items-center gap-1.5 flex-wrap">
            <span className="font-bold text-sm">{row.pelangganNama}</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded font-extrabold border ${stage.color}`}
            >
              {stage.text}
            </span>
            {row.lastReminderStage && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 inline-flex items-center gap-0.5">
                <History size={9} /> Pernah stage {row.lastReminderStage}
              </span>
            )}
          </div>
          <div className="text-xs text-[color:var(--muted)] mt-0.5">
            {row.nomorOrder} · {formatRupiah(row.totalPiutang)} ·{" "}
            <b>{row.daysAge} hari</b>
            {row.pelangganTelp && ` · ${row.pelangganTelp}`}
          </div>
        </div>

        {!showSkip && (
          <div className="flex flex-wrap gap-1.5">
            {notelpValid ? (
              <>
                <button
                  onClick={handleOpenWa}
                  disabled={pending}
                  className={`px-3 py-1.5 rounded text-xs font-bold inline-flex items-center gap-1 ${
                    waOpened
                      ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                      : "bg-emerald-600 text-white hover:bg-emerald-700"
                  }`}
                >
                  <ExternalLink size={11} />
                  {waOpened ? "WA Dibuka" : "Kirim WA"}
                </button>
                <button
                  onClick={handleMarkSent}
                  disabled={pending}
                  className="px-3 py-1.5 bg-brand-600 text-white rounded text-xs font-bold inline-flex items-center gap-1 disabled:opacity-50"
                  title="Mark reminder ini sudah dikirim"
                >
                  {pending ? (
                    <Loader2 size={11} className="animate-spin" />
                  ) : (
                    <Check size={11} />
                  )}
                  Sudah Dikirim
                </button>
              </>
            ) : (
              <div className="text-[10px] text-red-600 font-bold inline-flex items-center gap-1">
                <AlertTriangle size={11} />
                Tidak ada no. WA
              </div>
            )}
            <button
              onClick={() => setShowSkip(true)}
              disabled={pending}
              className="px-2 py-1.5 text-xs text-[color:var(--muted)] hover:text-red-600 border border-line rounded"
              title="Skip reminder ini"
            >
              <X size={11} />
            </button>
          </div>
        )}
      </div>

      {showSkip && (
        <div className="mt-2 pt-2 border-t border-line space-y-2">
          <div className="text-xs font-bold">Skip reminder — alasan wajib:</div>
          <input
            type="text"
            value={skipAlasan}
            onChange={(e) => setSkipAlasan(e.target.value)}
            placeholder="mis: pelanggan sudah bayar cash langsung, belum di-input"
            className="w-full px-2 py-1.5 border border-line rounded text-xs"
            autoFocus
          />
          <div className="flex gap-1.5">
            <button
              onClick={handleSkip}
              disabled={pending}
              className="px-2 py-1.5 bg-red-600 text-white rounded text-xs font-bold disabled:opacity-50"
            >
              {pending ? "..." : "Skip"}
            </button>
            <button
              onClick={() => {
                setShowSkip(false);
                setSkipAlasan("");
                setErr(null);
              }}
              className="px-2 py-1.5 border border-line rounded text-xs"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {err && (
        <div className="text-[10px] text-red-600 font-bold mt-1">{err}</div>
      )}
    </div>
  );
}
