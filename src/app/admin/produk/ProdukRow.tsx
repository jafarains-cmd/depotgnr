"use client";

import { useState, useTransition } from "react";
import { Pencil, Trash2, X } from "lucide-react";
import { deleteProduk, toggleAktif } from "./actions";
import { ProdukForm } from "./ProdukForm";

type Row = {
  id: number;
  nama: string;
  deskripsi: string | null;
  hargaIsiUlang: number;
  hargaTukar: number;
  hargaBeliBaru: number;
  aktif: boolean;
  hargaIsiUlangFmt: string;
  hargaTukarFmt: string;
  hargaBeliBaruFmt: string;
};

export function ProdukRow({ produk }: { produk: Row }) {
  const [editing, setEditing] = useState(false);
  const [, startTransition] = useTransition();

  if (editing) {
    return (
      <tr>
        <td colSpan={6} className="p-3 bg-[color:var(--surface2)]">
          <div className="flex justify-between items-center mb-2">
            <span className="font-medium">Edit: {produk.nama}</span>
            <button onClick={() => setEditing(false)} className="text-[color:var(--muted)] hover:text-ink">
              <X size={16} />
            </button>
          </div>
          <ProdukForm initial={produk} onDone={() => setEditing(false)} />
        </td>
      </tr>
    );
  }

  return (
    <tr className="hover:bg-[color:var(--surface2)]">
      <td className="p-3">
        <div className="font-medium">{produk.nama}</div>
        {produk.deskripsi && <div className="text-xs text-[color:var(--muted)]">{produk.deskripsi}</div>}
      </td>
      <td className="p-3 text-right">
        {produk.hargaIsiUlangFmt}
        <div className="sm:hidden text-[10px] text-[color:var(--muted)] mt-0.5">
          Tukar: {produk.hargaTukarFmt} · Baru: {produk.hargaBeliBaruFmt}
        </div>
      </td>
      <td className="p-3 text-right hidden sm:table-cell">{produk.hargaTukarFmt}</td>
      <td className="p-3 text-right hidden sm:table-cell">{produk.hargaBeliBaruFmt}</td>
      <td className="p-3 hidden md:table-cell">
        <button
          onClick={() => startTransition(() => toggleAktif(produk.id, !produk.aktif))}
          className={`px-2 py-0.5 rounded-full text-xs ${
            produk.aktif ? "bg-emerald-100 text-emerald-700" : "bg-[color:var(--surface2)] text-[color:var(--muted)]"
          }`}
        >
          {produk.aktif ? "Aktif" : "Nonaktif"}
        </button>
      </td>
      <td className="p-3 text-right space-x-2">
        <button onClick={() => setEditing(true)} className="text-brand-600 hover:text-brand-700">
          <Pencil size={14} />
        </button>
        <button
          onClick={() => {
            if (confirm(`Hapus produk "${produk.nama}"?`)) {
              startTransition(() => deleteProduk(produk.id));
            }
          }}
          className="text-red-500 hover:text-red-700"
        >
          <Trash2 size={14} />
        </button>
      </td>
    </tr>
  );
}
