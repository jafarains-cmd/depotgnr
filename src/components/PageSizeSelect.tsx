"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";

const OPTIONS = [
  { value: "20", label: "20" },
  { value: "50", label: "50" },
  { value: "100", label: "100" },
  { value: "all", label: "Semua" },
] as const;

const ALL_THRESHOLD = 10000;

export function PageSizeSelect({ value }: { value: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const current = value >= ALL_THRESHOLD ? "all" : String(value);

  function handleChange(next: string) {
    const sp = new URLSearchParams(params.toString());
    sp.set("limit", next);
    sp.delete("page");
    startTransition(() => {
      router.push(`${pathname}?${sp.toString()}`);
    });
  }

  return (
    <label className="text-xs text-[color:var(--muted)] inline-flex items-center gap-1.5">
      Tampil
      <select
        value={current}
        disabled={pending}
        onChange={(e) => handleChange(e.target.value)}
        className="px-2 py-1 border border-line rounded-md text-xs bg-surface"
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      baris
    </label>
  );
}
