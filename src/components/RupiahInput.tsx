"use client";

import { forwardRef } from "react";
import { terbilangRupiah } from "@/lib/terbilang";

type Props = {
  /** Value sebagai plain digit string (tanpa titik ribuan). Contoh: "150000". */
  value: string;
  /** Callback dengan plain digit string (siap parseInt). */
  onChange: (digits: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  className?: string;
  /**
   * Kalau true, tampilkan preview terbilang di bawah input.
   * Selalu tampil kalau value >= 1000 untuk mencegah typo "150" vs "150.000".
   */
  showTerbilang?: boolean;
  /**
   * Warning kalau jumlah digit < threshold ini (min 1, max 6).
   * Contoh: 4 → warn kalau input < 1000 rupiah. Default 4.
   * Set 0 untuk disable warning.
   */
  warnLowDigits?: number;
  /** Label warning custom. Default: "Yakin cuma X rupiah? Mungkin maksud X ribu?" */
  warnLabel?: string;
  /**
   * Nama field untuk form. Digunakan di form uncontrolled — hidden input dengan
   * value plain digits.
   */
  name?: string;
  /** HTML id for label associations. */
  id?: string;
};

function formatWithDots(digits: string): string {
  if (!digits) return "";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/**
 * Input Rupiah dengan format live (titik ribuan) + preview terbilang +
 * warning digit rendah. Solusi typo "150" → "150.000" yang bikin selisih besar.
 *
 * Value model: string plain digits ("150000"). Format display cuma untuk mata,
 * tidak masuk ke onChange atau value.
 */
export const RupiahInput = forwardRef<HTMLInputElement, Props>(function RupiahInput(
  {
    value,
    onChange,
    placeholder,
    autoFocus,
    disabled,
    className,
    showTerbilang,
    warnLowDigits = 4,
    warnLabel,
    name,
    id,
  },
  ref,
) {
  const digits = value.replace(/\D/g, "");
  const num = digits ? parseInt(digits, 10) : 0;
  const display = formatWithDots(digits);

  // Warning: digit < threshold (misal typo "150" alih2 "150000")
  const showWarning =
    warnLowDigits > 0 && digits.length > 0 && digits.length < warnLowDigits;
  const suggestion = digits ? `${display}.000` : "";
  const defaultWarnLabel = suggestion
    ? `Cuma Rp ${display}? Mungkin maksud Rp ${suggestion} (${digits} ribu)?`
    : "";

  const showTerb =
    (showTerbilang ?? true) && num >= 1000;

  return (
    <div className="space-y-1">
      <input
        ref={ref}
        type="text"
        inputMode="numeric"
        value={display}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
        placeholder={placeholder}
        autoFocus={autoFocus}
        disabled={disabled}
        id={id}
        className={
          className ??
          "w-full px-3 py-2 border border-line rounded-lg text-sm font-bold tabular-nums"
        }
      />
      {name && <input type="hidden" name={name} value={digits} />}

      {/* Preview terbilang (kalau >= 1.000) */}
      {showTerb && (
        <div className="text-[11px] text-[color:var(--muted)] italic capitalize">
          = {terbilangRupiah(num)}
        </div>
      )}

      {/* Warning digit rendah */}
      {showWarning && (
        <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1 leading-snug">
          ⚠ {warnLabel ?? defaultWarnLabel}
        </div>
      )}
    </div>
  );
});
