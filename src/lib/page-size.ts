const ALLOWED = [20, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 20;
/** Sentinel "Semua" — limit super tinggi, cukup untuk skala UMKM. */
export const ALL_PAGE_SIZE = 100000;

/**
 * Parse limit dari searchParams. Whitelist 20/50/100/all, default 20.
 * Pakai bersama <PageSizeSelect>.
 */
export function parseLimit(raw: string | undefined): number {
  if (raw === "all") return ALL_PAGE_SIZE;
  const n = Number(raw);
  return (ALLOWED as readonly number[]).includes(n) ? n : DEFAULT_PAGE_SIZE;
}

/**
 * Parse page dari searchParams (1-indexed). Default 1.
 */
export function parsePage(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

/**
 * Hitung offset & total halaman.
 */
export function getPagination(args: { total: number; limit: number; page: number }) {
  const totalPages = Math.max(1, Math.ceil(args.total / args.limit));
  const safePage = Math.min(Math.max(1, args.page), totalPages);
  return {
    offset: (safePage - 1) * args.limit,
    page: safePage,
    totalPages,
  };
}
