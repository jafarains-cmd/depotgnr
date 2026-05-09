/**
 * Helper status filter pemeliharaan — pure function, no DB.
 * Pakai di server & client.
 */

export type FilterStatus = "ok" | "due_soon" | "overdue" | "never";

const DUE_SOON_DAYS = 7;

export function computeFilterStatus(args: {
  gantiTerakhir: Date | string | null;
  intervalHari: number;
  now?: Date;
}): {
  status: FilterStatus;
  daysLeft: number | null;
  nextDueAt: Date | null;
} {
  const now = args.now ?? new Date();
  if (!args.gantiTerakhir) {
    return { status: "never", daysLeft: null, nextDueAt: null };
  }
  const last = new Date(args.gantiTerakhir);
  const nextDueAt = new Date(last);
  nextDueAt.setDate(nextDueAt.getDate() + args.intervalHari);
  const daysLeft = Math.ceil((nextDueAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  let status: FilterStatus;
  if (daysLeft < 0) status = "overdue";
  else if (daysLeft <= DUE_SOON_DAYS) status = "due_soon";
  else status = "ok";

  return { status, daysLeft, nextDueAt };
}

export const STATUS_COLOR: Record<FilterStatus, { bg: string; fg: string; label: string }> =
  {
    ok: { bg: "bg-emerald-50", fg: "text-emerald-700", label: "OK" },
    due_soon: { bg: "bg-amber-50", fg: "text-amber-700", label: "Mendekati" },
    overdue: { bg: "bg-rose-50", fg: "text-rose-700", label: "TELAT" },
    never: { bg: "bg-[color:var(--surface2)]", fg: "text-[color:var(--muted)]", label: "Belum pernah" },
  };
