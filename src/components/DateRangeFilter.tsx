"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Calendar, X } from "lucide-react";
import { type DateRangeKey, RANGE_LABELS, toInputDate } from "@/lib/date-range";

const PRESETS: DateRangeKey[] = ["today", "7d", "30d", "month", "prev_month", "all"];

export function DateRangeFilter({
  active,
  customFrom,
  customTo,
  basePath,
  preserveParams = [],
}: {
  active: DateRangeKey;
  customFrom?: Date | null;
  customTo?: Date | null;
  /** Path halaman saat ini, mis. "/kasir/order" */
  basePath: string;
  /** Param query lain yang harus dipertahankan saat ganti range (mis. ["filter"]) */
  preserveParams?: string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showCustom, setShowCustom] = useState(active === "custom");
  const [from, setFrom] = useState(toInputDate(customFrom ?? null));
  const [to, setTo] = useState(toInputDate(customTo ?? null));

  function buildUrl(updates: Record<string, string | null>) {
    const params = new URLSearchParams();
    // Preserve other params
    for (const key of preserveParams) {
      const v = searchParams.get(key);
      if (v) params.set(key, v);
    }
    for (const [k, v] of Object.entries(updates)) {
      if (v !== null && v !== "") params.set(k, v);
    }
    const qs = params.toString();
    return `${basePath}${qs ? `?${qs}` : ""}`;
  }

  function selectPreset(key: DateRangeKey) {
    setShowCustom(false);
    router.push(buildUrl({ range: key, from: null, to: null }));
  }

  function applyCustom() {
    if (!from && !to) return;
    router.push(buildUrl({ range: "custom", from, to }));
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5 items-center">
        {PRESETS.map((key) => {
          const isActive = active === key;
          return (
            <button
              key={key}
              onClick={() => selectPreset(key)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition ${
                isActive
                  ? "bg-brand text-white"
                  : "bg-surface border border-line text-[color:var(--muted)] hover:text-ink"
              }`}
            >
              {RANGE_LABELS[key]}
            </button>
          );
        })}
        <button
          onClick={() => setShowCustom((v) => !v)}
          className={`px-3 py-1.5 rounded-full text-xs font-bold transition inline-flex items-center gap-1 ${
            active === "custom"
              ? "bg-brand text-white"
              : "bg-surface border border-line text-[color:var(--muted)] hover:text-ink"
          }`}
        >
          <Calendar size={11} /> Custom
        </button>
      </div>

      {showCustom && (
        <div className="bg-surface border border-line rounded-xl p-3 flex flex-wrap items-end gap-2">
          <div>
            <label className="block text-[10px] font-bold text-[color:var(--muted)] uppercase tracking-wide mb-0.5">
              Dari
            </label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="px-2.5 py-1.5 border border-line rounded-md text-sm bg-surface"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-[color:var(--muted)] uppercase tracking-wide mb-0.5">
              Sampai
            </label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="px-2.5 py-1.5 border border-line rounded-md text-sm bg-surface"
            />
          </div>
          <button
            onClick={applyCustom}
            disabled={!from && !to}
            className="px-3 py-1.5 bg-brand text-white rounded-md text-xs font-bold disabled:opacity-50"
          >
            Terapkan
          </button>
          {active === "custom" && (
            <button
              onClick={() => {
                setFrom("");
                setTo("");
                router.push(buildUrl({ range: "30d", from: null, to: null }));
              }}
              className="px-2 py-1.5 text-xs text-[color:var(--muted)] hover:text-red-600 inline-flex items-center gap-1"
            >
              <X size={11} /> Reset
            </button>
          )}
        </div>
      )}
    </div>
  );
}
