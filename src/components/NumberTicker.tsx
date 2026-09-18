"use client";

import { motion, useInView, useMotionValue, useSpring } from "framer-motion";
import { useEffect, useRef } from "react";

/**
 * Magic UI Number Ticker — angka counter yang animate dari 0 → target value
 * saat masuk viewport. Adapted untuk locale Indonesia (id-ID).
 *
 * Ref: https://magicui.design/docs/components/number-ticker
 * License: MIT
 *
 * Usage:
 *   <NumberTicker value={1234567} />              → 1.234.567
 *   <NumberTicker value={99.5} decimalPlaces={1} /> → 99,5
 *   <NumberTicker value={5000} prefix="Rp " />     → Rp 5.000
 *
 * Kalau user pilih reduced-motion di OS, langsung render final value (tanpa animate).
 */
export function NumberTicker({
  value,
  direction = "up",
  delay = 0,
  decimalPlaces = 0,
  prefix = "",
  suffix = "",
  className,
}: {
  value: number;
  direction?: "up" | "down";
  delay?: number;
  decimalPlaces?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(direction === "down" ? value : 0);
  const springValue = useSpring(motionValue, {
    damping: 60,
    stiffness: 100,
  });
  const isInView = useInView(ref, { once: true, margin: "0px" });

  // Cek prefers-reduced-motion — user yang set ini di OS mau tidak ada animasi
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (!isInView) return;
    if (prefersReducedMotion) {
      // Skip animate, langsung set final value
      motionValue.set(value);
      return;
    }
    const timer = setTimeout(() => {
      motionValue.set(direction === "down" ? 0 : value);
    }, delay * 1000);
    return () => clearTimeout(timer);
  }, [motionValue, isInView, delay, value, direction, prefersReducedMotion]);

  useEffect(() => {
    return springValue.on("change", (latest) => {
      if (!ref.current) return;
      const formatted = Intl.NumberFormat("id-ID", {
        minimumFractionDigits: decimalPlaces,
        maximumFractionDigits: decimalPlaces,
      }).format(Number(latest.toFixed(decimalPlaces)));
      ref.current.textContent = prefix + formatted + suffix;
    });
  }, [springValue, decimalPlaces, prefix, suffix]);

  // SSR: render final formatted value supaya tidak flash 0 saat hydration
  const initial = Intl.NumberFormat("id-ID", {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
  }).format(direction === "down" ? value : 0);

  return (
    <motion.span ref={ref} className={className}>
      {prefix}
      {initial}
      {suffix}
    </motion.span>
  );
}
