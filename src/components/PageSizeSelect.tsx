"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";

const OPTIONS = [20, 50, 100] as const;
type Size = typeof OPTIONS[number];

export function PageSizeSelect({ value }: { value: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function handleChange(next: Size) {
    const sp = new URLSearchParams(params.toString());
    sp.set("limit", String(next));
    startTransition(() => {
      router.push(`${pathname}?${sp.toString()}`);
    });
  }

  return (
    <label className="text-xs text-[color:var(--muted)] inline-flex items-center gap-1.5">
      Tampil
      <select
        value={value}
        disabled={pending}
        onChange={(e) => handleChange(Number(e.target.value) as Size)}
        className="px-2 py-1 border border-line rounded-md text-xs bg-surface"
      >
        {OPTIONS.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
      baris
    </label>
  );
}
