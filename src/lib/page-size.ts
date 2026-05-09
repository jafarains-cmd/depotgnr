const ALLOWED = [20, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 20;

/**
 * Parse limit dari searchParams. Whitelist 20/50/100, default 20.
 * Pakai bersama <PageSizeSelect>.
 */
export function parseLimit(raw: string | undefined): number {
  const n = Number(raw);
  return (ALLOWED as readonly number[]).includes(n) ? n : DEFAULT_PAGE_SIZE;
}
