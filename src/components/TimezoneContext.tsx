"use client";

import { createContext, useContext } from "react";
import { DEFAULT_ZONA, formatTanggal } from "@/lib/timezone";

const TimezoneContext = createContext<string>(DEFAULT_ZONA);

export function TimezoneProvider({
  zona,
  children,
}: {
  zona: string;
  children: React.ReactNode;
}) {
  return <TimezoneContext.Provider value={zona}>{children}</TimezoneContext.Provider>;
}

export function useTimezone(): string {
  return useContext(TimezoneContext);
}

/**
 * Hook helper: format tanggal pakai zona dari context. Wrapper toLocaleString.
 */
export function useFormatTanggal() {
  const tz = useTimezone();
  return (date: Date | string | number, options: Intl.DateTimeFormatOptions) =>
    formatTanggal(date, options, tz);
}
