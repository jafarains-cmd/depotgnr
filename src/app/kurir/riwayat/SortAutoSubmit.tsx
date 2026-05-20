"use client";

const OPTIONS: { value: string; label: string }[] = [
  { value: "tgl-desc", label: "Tanggal order ↓" },
  { value: "tgl-asc", label: "Tanggal order ↑" },
  { value: "antar-desc", label: "Tanggal antar ↓" },
  { value: "antar-asc", label: "Tanggal antar ↑" },
  { value: "total-desc", label: "Nilai order ↓" },
  { value: "total-asc", label: "Nilai order ↑" },
  { value: "pelanggan-asc", label: "Pelanggan A-Z" },
];

export function SortAutoSubmit({ value }: { value: string }) {
  return (
    <label className="text-xs text-[color:var(--muted)] inline-flex items-center gap-1.5">
      Urut
      <select
        name="sort"
        defaultValue={value}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
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
