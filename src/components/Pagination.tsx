"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function Pagination({
  page,
  totalPages,
  total,
}: {
  page: number;
  totalPages: number;
  total?: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  if (totalPages <= 1) return null;

  function goto(p: number) {
    const sp = new URLSearchParams(params.toString());
    if (p <= 1) sp.delete("page");
    else sp.set("page", String(p));
    startTransition(() => {
      router.push(`${pathname}?${sp.toString()}`);
    });
  }

  const canPrev = page > 1;
  const canNext = page < totalPages;

  // Buat array nomor halaman: [1, 2, ..., 8] dengan ellipsis
  // Tampilkan: first, last, current ± 1, dan "..." kalau ada gap
  const pages: (number | "...")[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (
      i === 1 ||
      i === totalPages ||
      (i >= page - 1 && i <= page + 1)
    ) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== "...") {
      pages.push("...");
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 flex-wrap pt-3">
      <div className="text-xs text-[color:var(--muted)]">
        Halaman <span className="font-bold">{page}</span> dari {totalPages}
        {total !== undefined && (
          <>
            {" · "}
            <span>{total} total</span>
          </>
        )}
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => goto(page - 1)}
          disabled={!canPrev || pending}
          className="px-2 py-1.5 rounded-md border border-line text-xs font-bold inline-flex items-center gap-0.5 disabled:opacity-40 hover:border-brand hover:text-brand transition"
        >
          <ChevronLeft size={14} />
          <span className="hidden sm:inline">Sblm</span>
        </button>

        {pages.map((p, idx) =>
          p === "..." ? (
            <span
              key={`e${idx}`}
              className="w-8 text-center text-xs text-[color:var(--muted)]"
            >
              ...
            </span>
          ) : (
            <button
              key={p}
              onClick={() => goto(p)}
              disabled={pending}
              className={`w-8 h-8 rounded-md text-xs font-bold transition ${
                p === page
                  ? "bg-brand text-white"
                  : "border border-line hover:border-brand hover:text-brand"
              }`}
            >
              {p}
            </button>
          ),
        )}

        <button
          onClick={() => goto(page + 1)}
          disabled={!canNext || pending}
          className="px-2 py-1.5 rounded-md border border-line text-xs font-bold inline-flex items-center gap-0.5 disabled:opacity-40 hover:border-brand hover:text-brand transition"
        >
          <span className="hidden sm:inline">Lnjt</span>
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
