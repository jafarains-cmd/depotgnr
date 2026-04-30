"use client";

import Link from "next/link";

const FILTERS = [
  { id: "semua", label: "Semua" },
  { id: "aktif", label: "Aktif" },
  { id: "selesai", label: "Selesai" },
  { id: "batal", label: "Batal" },
];

export function RiwayatFilter({ active }: { active: string }) {
  return (
    <div className="flex gap-2 mt-3 overflow-x-auto no-scrollbar">
      {FILTERS.map((f) => {
        const isActive = active === f.id;
        return (
          <Link
            key={f.id}
            href={`/pelanggan/riwayat${f.id === "semua" ? "" : `?filter=${f.id}`}`}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition ${
              isActive
                ? "bg-brand text-white"
                : "bg-[color:var(--surface2)] text-[color:var(--muted)] hover:text-ink"
            }`}
          >
            {f.label}
          </Link>
        );
      })}
    </div>
  );
}
