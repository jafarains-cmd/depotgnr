"use client";

import { NumberTicker } from "./NumberTicker";

/**
 * Money display dengan format Rupiah animate (0 → target) saat masuk viewport.
 * Wrapper around NumberTicker dengan prefix "Rp " + locale id-ID.
 *
 * Fallback: kalau value null/undefined/NaN → tampilkan "Rp 0" static.
 * Reduced-motion friendly (dari NumberTicker).
 */
export function MoneyDisplay({
  value,
  className,
}: {
  value: number | null | undefined;
  className?: string;
}) {
  const safe = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return <NumberTicker value={safe} prefix="Rp " className={className} />;
}
