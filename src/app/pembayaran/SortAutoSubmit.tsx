"use client";

import { useRef } from "react";

const OPTIONS: { value: string; label: string }[] = [
  { value: "order-desc", label: "Tanggal order ↓ (terbaru)" },
  { value: "order-asc", label: "Tanggal order ↑ (terlama)" },
  { value: "bayar-desc", label: "Tanggal bayar ↓ (terbaru)" },
  { value: "bayar-asc", label: "Tanggal bayar ↑ (terlama)" },
];

export function SortAutoSubmit({ value }: { value: string }) {
  const selectRef = useRef<HTMLSelectElement>(null);

  return (
    <label className="text-xs text-[color:var(--muted)] inline-flex items-center gap-1.5">
      Urut
      <select
        ref={selectRef}
        name="sort"
        defaultValue={value}
        onChange={(e) => {
          // Auto-submit form parent saat pilihan berubah
          e.currentTarget.form?.requestSubmit();
        }}
        className="px-2 py-2 border border-line rounded-md text-xs bg-surface"
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
