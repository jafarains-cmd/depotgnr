/**
 * Date range parsing untuk filter halaman list.
 *
 * Preset key:
 *  - today      : 00:00 hari ini → sekarang
 *  - 7d         : 7 hari terakhir (termasuk hari ini)
 *  - 30d        : 30 hari terakhir (default kalau tidak ada query)
 *  - month      : bulan ini (1 → akhir bulan)
 *  - prev_month : bulan lalu (1 → akhir bulan)
 *  - all        : tanpa filter
 *  - custom     : pakai from/to dari query string
 */

export type DateRangeKey =
  | "today"
  | "7d"
  | "30d"
  | "month"
  | "prev_month"
  | "all"
  | "custom";

export const RANGE_LABELS: Record<DateRangeKey, string> = {
  today: "Hari Ini",
  "7d": "7 Hari",
  "30d": "30 Hari",
  month: "Bulan Ini",
  prev_month: "Bulan Lalu",
  all: "Semua",
  custom: "Custom",
};

/** Default kalau tidak ada query: 30 hari terakhir (lebih ringan dari Semua) */
export const DEFAULT_RANGE: DateRangeKey = "30d";

export type ParsedRange = {
  key: DateRangeKey;
  from: Date | null;
  to: Date | null;
};

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function parseRange(params: {
  range?: string;
  from?: string;
  to?: string;
}): ParsedRange {
  const now = new Date();

  // Custom: from/to query
  if (params.range === "custom" || params.from || params.to) {
    const f = params.from ? startOfDay(new Date(params.from)) : null;
    const t = params.to ? endOfDay(new Date(params.to)) : null;
    return {
      key: "custom",
      from: f && !isNaN(f.getTime()) ? f : null,
      to: t && !isNaN(t.getTime()) ? t : null,
    };
  }

  const key = (params.range as DateRangeKey) || DEFAULT_RANGE;

  switch (key) {
    case "today":
      return { key, from: startOfDay(now), to: endOfDay(now) };
    case "7d": {
      const from = startOfDay(now);
      from.setDate(from.getDate() - 6);
      return { key, from, to: endOfDay(now) };
    }
    case "30d": {
      const from = startOfDay(now);
      from.setDate(from.getDate() - 29);
      return { key, from, to: endOfDay(now) };
    }
    case "month": {
      const from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      return { key, from, to: endOfDay(now) };
    }
    case "prev_month": {
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      const to = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return { key, from, to };
    }
    case "all":
      return { key: "all", from: null, to: null };
    default:
      // Fallback ke default
      return parseRange({ range: DEFAULT_RANGE });
  }
}

/** Format date input value (yyyy-MM-dd) untuk <input type="date"> */
export function toInputDate(d: Date | null): string {
  if (!d) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
