"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { DetailModal } from "@/components/DetailModal";

type ClickTarget =
  | { kind: "order"; id: number }
  | { kind: "transaksi"; id: number }
  | { kind: "pelanggan"; id: number }
  | { kind: "shift"; id: number }
  | { kind: "pengeluaran"; id: number };

type Ctx = {
  open: (t: ClickTarget) => void;
};

const LaporanClickCtx = createContext<Ctx | null>(null);

export function LaporanClickProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<ClickTarget | null>(null);
  return (
    <LaporanClickCtx.Provider value={{ open: setTarget }}>
      {children}
      {target && target.kind !== "pengeluaran" && (
        <DetailModal
          kind={target.kind}
          id={target.id}
          onClose={() => setTarget(null)}
        />
      )}
      {target && target.kind === "pengeluaran" && (
        <PengeluaranQuickModal
          id={target.id}
          onClose={() => setTarget(null)}
        />
      )}
    </LaporanClickCtx.Provider>
  );
}

function useLaporanClick(): Ctx {
  const c = useContext(LaporanClickCtx);
  if (!c) throw new Error("LaporanRow harus di dalam LaporanClickProvider");
  return c;
}

type RowProps = {
  target: ClickTarget;
  children: ReactNode;
  className?: string;
};

export function LaporanRow({ target, children, className }: RowProps) {
  const { open } = useLaporanClick();
  return (
    <tr
      onClick={() => open(target)}
      className={`cursor-pointer hover:bg-brand-soft transition ${className ?? ""}`}
    >
      {children}
    </tr>
  );
}

/**
 * Div-based versi LaporanRow — dipakai untuk layout mobile (card).
 * Tetap clickable → membuka DetailModal yang sama dengan tabel desktop.
 */
export function LaporanCard({ target, children, className }: RowProps) {
  const { open } = useLaporanClick();
  return (
    <div
      onClick={() => open(target)}
      className={`cursor-pointer hover:bg-brand-soft transition p-3 ${className ?? ""}`}
    >
      {children}
    </div>
  );
}

/**
 * Pengeluaran belum punya DetailModal-kind sendiri. Sementara pakai
 * modal ringan yang fetch data via server action inline.
 */
function PengeluaranQuickModal({
  id,
  onClose,
}: {
  id: number;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 grid place-items-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface rounded-2xl max-w-md w-full p-5 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start">
          <h2 className="font-bold text-lg">Detail Pengeluaran #{id}</h2>
          <button onClick={onClose} className="text-xl">
            ×
          </button>
        </div>
        <p className="text-sm text-[color:var(--muted)]">
          Detail lengkap pengeluaran (kategori, deskripsi, jumlah, dicatat oleh,
          tanggal) — lihat baris di tabel. Untuk edit / hapus / lihat foto nota,
          buka halaman{" "}
          <a href="/admin/pengeluaran" className="text-brand underline">
            /admin/pengeluaran
          </a>
          .
        </p>
      </div>
    </div>
  );
}
