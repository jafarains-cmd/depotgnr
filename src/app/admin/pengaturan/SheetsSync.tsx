"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { FileSpreadsheet, Activity, BookOpen } from "lucide-react";
import {
  actionPing,
  actionEnsureSheets,
  actionPushProduk,
  actionPullProduk,
} from "./sheetsActions";

export function SheetsSync() {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function run(
    fn: () => Promise<{
      ok: boolean;
      error?: string;
      msg?: string;
      count?: number;
      updated?: number;
    }>,
    label: string,
  ) {
    startTransition(async () => {
      setMsg(null);
      const r = await fn();
      if (r.ok) {
        const detail =
          r.count !== undefined
            ? ` (${r.count} baris)`
            : r.updated !== undefined
              ? ` (${r.updated} produk diupdate)`
              : r.msg
                ? `: ${r.msg}`
                : "";
        setMsg({ ok: true, text: `${label} berhasil${detail}.` });
      } else {
        setMsg({ ok: false, text: r.error ?? "Gagal" });
      }
    });
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3 mt-4">
      <h2 className="font-semibold inline-flex items-center gap-1.5">
        <FileSpreadsheet size={16} /> Google Sheets Sync (Apps Script)
      </h2>
      <p className="text-sm text-slate-600">
        Pakai Apps Script Web App sebagai jembatan ke Google Sheets — tidak butuh service
        account.{" "}
        <Link
          href="/admin/bantuan#sheets"
          className="text-brand-600 underline inline-flex items-center gap-1"
        >
          <BookOpen size={12} /> Lihat panduan lengkap
        </Link>
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          disabled={pending}
          onClick={() => run(actionPing, "Test koneksi")}
          className="px-3 py-2 border border-slate-300 rounded-md text-sm disabled:opacity-50 inline-flex items-center gap-1.5"
        >
          <Activity size={14} /> Test Koneksi
        </button>
        <button
          disabled={pending}
          onClick={() => run(actionEnsureSheets, "Inisialisasi tab")}
          className="px-3 py-2 border border-slate-300 rounded-md text-sm disabled:opacity-50"
        >
          Inisialisasi Tab + Header
        </button>
        <button
          disabled={pending}
          onClick={() => run(actionPushProduk, "Push produk")}
          className="px-3 py-2 bg-brand-600 text-white rounded-md text-sm disabled:opacity-50"
        >
          Push Produk → Sheets
        </button>
        <button
          disabled={pending}
          onClick={() => run(actionPullProduk, "Pull produk")}
          className="px-3 py-2 bg-amber-600 text-white rounded-md text-sm disabled:opacity-50"
        >
          Pull Produk ← Sheets
        </button>
      </div>
      {msg && (
        <div
          className={`text-sm whitespace-pre-wrap ${
            msg.ok ? "text-emerald-700" : "text-red-600"
          }`}
        >
          {msg.text}
        </div>
      )}
      <p className="text-xs text-slate-500">
        Transaksi dan order baru otomatis di-append ke sheet saat dibuat (kalau URL + token sudah diisi).
      </p>
    </div>
  );
}
