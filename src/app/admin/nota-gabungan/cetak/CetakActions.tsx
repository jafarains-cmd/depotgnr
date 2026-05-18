"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Printer, Check } from "lucide-react";
import { tandaiLunasBatch } from "../actions";

export function CetakActions({
  orderIds,
  adaBelumLunas,
  allLunas,
}: {
  orderIds: number[];
  adaBelumLunas: boolean;
  allLunas: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function handleCetak() {
    window.print();
  }

  function handleTandaiLunas() {
    if (
      !confirm(
        `Tandai ${orderIds.length} order ini sebagai LUNAS sekaligus? Pastikan pelanggan sudah benar-benar membayar semua.`,
      )
    )
      return;
    setMsg(null);
    startTransition(async () => {
      const r = await tandaiLunasBatch(orderIds);
      if ("error" in r) {
        setMsg(`❌ ${r.error}`);
      } else {
        setMsg(
          `✅ ${r.ditandai} order ditandai lunas${r.sudahLunas > 0 ? ` (${r.sudahLunas} sudah lunas sebelumnya)` : ""}.`,
        );
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Link
          href="/admin/nota-gabungan"
          className="text-sm text-[color:var(--muted)] hover:text-brand inline-flex items-center gap-1"
        >
          <ArrowLeft size={14} /> Kembali
        </Link>
      </div>

      <div className="bg-surface border border-line rounded-2xl p-3 space-y-2">
        <button
          onClick={handleCetak}
          className="w-full py-2 bg-slate-800 text-white rounded-md text-sm font-bold inline-flex items-center justify-center gap-1.5"
        >
          <Printer size={14} /> Cetak / Save PDF
        </button>

        {adaBelumLunas && (
          <button
            onClick={handleTandaiLunas}
            disabled={pending}
            className="w-full py-2 bg-emerald-600 text-white rounded-md text-sm font-extrabold inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <Check size={14} /> {pending ? "Memproses..." : "Tandai Semua Lunas"}
          </button>
        )}

        {allLunas && (
          <div className="text-xs text-emerald-700 bg-emerald-50 rounded p-2">
            ✓ Semua order sudah lunas. Nota ini hanya untuk arsip/rekap.
          </div>
        )}

        {msg && (
          <div className="text-xs bg-[color:var(--surface2)] rounded p-2">{msg}</div>
        )}
      </div>
    </div>
  );
}
