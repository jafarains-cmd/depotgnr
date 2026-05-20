"use client";

/**
 * Select yang auto-submit form parent saat value berubah.
 * Generic supaya bisa dipakai di filter status / kategori.
 */
export function AutoSubmitSelect({
  name,
  value,
  options,
  label,
}: {
  name: string;
  value: string;
  options: { value: string; label: string }[];
  label?: string;
}) {
  return (
    <label className="text-xs text-[color:var(--muted)] inline-flex items-center gap-1.5">
      {label && <span>{label}</span>}
      <select
        name={name}
        defaultValue={value}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="px-2 py-1.5 border border-line rounded-md bg-surface"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
