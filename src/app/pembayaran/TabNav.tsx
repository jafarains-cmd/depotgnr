import Link from "next/link";

type Tab = "menunggu" | "piutang" | "lunas" | "all";

export function TabNav({
  active,
  counts,
  baseQuery,
}: {
  active: Tab;
  counts: { all: number; menunggu: number; piutang: number; lunas: number };
  baseQuery: string;
}) {
  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "menunggu", label: "Menunggu Verifikasi", count: counts.menunggu },
    { id: "piutang", label: "Piutang", count: counts.piutang },
    { id: "lunas", label: "Lunas", count: counts.lunas },
    { id: "all", label: "Semua", count: counts.all },
  ];

  function hrefFor(id: Tab) {
    const q = new URLSearchParams(baseQuery);
    q.set("tab", id);
    q.delete("page"); // reset ke halaman 1 saat pindah tab
    return `/pembayaran?${q.toString()}`;
  }

  return (
    <div className="flex gap-2 text-sm flex-wrap">
      {tabs.map((t) => {
        const isActive = active === t.id;
        return (
          <Link
            key={t.id}
            href={hrefFor(t.id)}
            className={`px-3.5 py-1.5 rounded-full font-bold text-xs transition ${
              isActive
                ? "bg-brand text-white"
                : "bg-surface border border-line text-[color:var(--muted)] hover:text-ink"
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span
                className={`ml-1.5 px-1.5 py-0.5 rounded text-[10px] ${
                  isActive
                    ? "bg-white/30"
                    : "bg-[color:var(--accent2)] text-white"
                }`}
              >
                {t.count}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
