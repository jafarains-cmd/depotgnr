"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, X, Loader2, Truck } from "lucide-react";
import { adjustGalonPinjamManual } from "@/app/data-pelanggan/actions";
import {
  searchPelangganForGalon,
  getSaldoGalonPelangganProduk,
} from "./actions";

type PelangganRow = {
  id: number;
  nama: string;
  telp: string | null;
  saldoGalon: number;
};

type Produk = { id: number; nama: string };

export function TambahGalonButton({ produkList }: { produkList: Produk[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 transition"
      >
        <Plus size={14} /> Sesuaikan Pinjaman
      </button>
      {open && (
        <TambahGalonModal produkList={produkList} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

function TambahGalonModal({
  produkList,
  onClose,
}: {
  produkList: Produk[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PelangganRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<PelangganRow | null>(null);

  const [produkId, setProdukId] = useState(produkList[0]?.id ?? 0);
  const [saldoCurrent, setSaldoCurrent] = useState<number | null>(null);
  const [saldoBaru, setSaldoBaru] = useState("");
  const [alasan, setAlasan] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function handleSearch(q: string) {
    setQuery(q);
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const rows = await searchPelangganForGalon(q);
      setResults(rows);
    } finally {
      setSearching(false);
    }
  }

  async function pickPelanggan(p: PelangganRow) {
    setSelected(p);
    setResults([]);
    setQuery(p.nama);
    const s = await getSaldoGalonPelangganProduk(p.id, produkId);
    setSaldoCurrent(s);
    setSaldoBaru(String(s));
  }

  async function handleProdukChange(newProdukId: number) {
    setProdukId(newProdukId);
    if (selected) {
      const s = await getSaldoGalonPelangganProduk(selected.id, newProdukId);
      setSaldoCurrent(s);
      setSaldoBaru(String(s));
    }
  }

  function handleSubmit() {
    setErr(null);
    if (!selected) {
      setErr("Pilih pelanggan dulu");
      return;
    }
    if (!produkId) {
      setErr("Pilih produk galon");
      return;
    }
    const baru = parseInt(saldoBaru.replace(/\D/g, ""), 10);
    if (!Number.isFinite(baru) || baru < 0) {
      setErr("Saldo baru harus angka >= 0");
      return;
    }
    if (saldoCurrent === null) {
      setErr("Loading saldo, tunggu sebentar…");
      return;
    }
    const perubahan = baru - saldoCurrent;
    if (perubahan === 0) {
      setErr("Saldo baru sama dengan sekarang — tidak ada yang diubah");
      return;
    }
    if (alasan.trim().length < 3) {
      setErr("Alasan wajib (min 3 karakter)");
      return;
    }

    startTransition(async () => {
      const res = await adjustGalonPinjamManual({
        pelangganId: selected.id,
        produkId,
        perubahan,
        alasan: alasan.trim(),
      });
      if ("error" in res) {
        setErr(res.error);
        return;
      }
      onClose();
      router.refresh();
    });
  }

  const baruNum = parseInt(saldoBaru.replace(/\D/g, ""), 10) || 0;
  const selisih = saldoCurrent !== null ? baruNum - saldoCurrent : 0;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 grid place-items-center p-4 overflow-auto">
      <div className="bg-surface rounded-2xl max-w-lg w-full p-5 space-y-3 my-4">
        <div className="flex justify-between items-start">
          <h2 className="font-bold text-lg inline-flex items-center gap-1.5">
            <Truck size={18} className="text-amber-600" />
            Sesuaikan Galon Pinjaman
          </h2>
          <button onClick={onClose} disabled={pending}>
            <X size={20} />
          </button>
        </div>

        <div className="text-xs text-[color:var(--muted)] bg-amber-50 border border-amber-200 rounded-lg p-2.5 leading-relaxed">
          Gunakan untuk:
          <ul className="list-disc list-inside mt-1 space-y-0.5">
            <li>
              <b>Kurangi</b> — pelanggan mengembalikan galon depot
            </li>
            <li>
              <b>Tambah</b> — pelanggan pinjam galon tambahan (di luar POS)
            </li>
            <li>
              <b>Koreksi</b> — perbaiki selisih hitung / catat baseline
              pelanggan lama
            </li>
          </ul>
          <div className="mt-1 text-[color:var(--muted)]">
            Untuk transaksi normal, tetap pakai POS Kasir / konfirmasi kurir.
          </div>
        </div>

        {/* Search pelanggan */}
        <div>
          <label className="text-xs font-bold block mb-1">
            Pelanggan (min 2 karakter)
          </label>
          <div className="relative">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[color:var(--muted)]"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setSelected(null);
                setSaldoCurrent(null);
                handleSearch(e.target.value);
              }}
              placeholder="Cari nama atau telp…"
              className="w-full pl-8 pr-3 py-2 border border-line rounded-md text-sm"
              autoFocus
            />
          </div>

          {searching && (
            <div className="text-[10px] text-[color:var(--muted)] mt-1 inline-flex items-center gap-1">
              <Loader2 size={10} className="animate-spin" /> Mencari…
            </div>
          )}

          {results.length > 0 && !selected && (
            <div className="mt-1 border border-line rounded-lg max-h-48 overflow-y-auto bg-surface">
              {results.map((p) => (
                <button
                  key={p.id}
                  onClick={() => pickPelanggan(p)}
                  className="w-full text-left px-3 py-2 hover:bg-brand-soft border-b border-line last:border-0"
                >
                  <div className="font-bold text-sm">{p.nama}</div>
                  <div className="text-[10px] text-[color:var(--muted)] flex justify-between">
                    <span>{p.telp ?? "—"}</span>
                    {p.saldoGalon > 0 && (
                      <span className="text-amber-700 font-bold">
                        {p.saldoGalon} galon
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {selected && (
          <>
            <div className="bg-brand-soft border border-brand/20 rounded-lg p-2.5 text-sm">
              <div className="font-bold">{selected.nama}</div>
              {selected.telp && (
                <div className="text-xs text-[color:var(--muted)]">
                  {selected.telp}
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-bold block mb-1">
                Produk Galon
              </label>
              <select
                value={produkId}
                onChange={(e) => handleProdukChange(Number(e.target.value))}
                className="w-full px-3 py-2 border border-line rounded-md text-sm bg-surface"
              >
                {produkList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nama}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold block mb-1 text-[color:var(--muted)]">
                  Saldo sekarang
                </label>
                <div className="px-3 py-2 border border-line rounded-md text-sm font-mono font-bold bg-[color:var(--surface2)]">
                  {saldoCurrent !== null ? `${saldoCurrent} galon` : "…"}
                </div>
              </div>
              <div>
                <label className="text-xs font-bold block mb-1">
                  Saldo baru
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={saldoBaru}
                  onChange={(e) =>
                    setSaldoBaru(e.target.value.replace(/\D/g, ""))
                  }
                  className="w-full px-3 py-2 border border-line rounded-md text-lg font-mono font-bold"
                />
              </div>
            </div>

            {saldoCurrent !== null && saldoBaru !== "" && (
              <div
                className={`rounded-lg p-2 text-xs font-bold text-center ${
                  selisih > 0
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : selisih < 0
                      ? "bg-red-50 text-red-700 border border-red-200"
                      : "bg-[color:var(--surface2)] text-[color:var(--muted)]"
                }`}
              >
                {selisih > 0
                  ? `+${selisih} galon (menambah pinjaman)`
                  : selisih < 0
                    ? `${selisih} galon (mengurangi pinjaman)`
                    : "Tidak ada perubahan"}
              </div>
            )}

            <div>
              <label className="text-xs font-bold block mb-1">
                Alasan (min 3 karakter) — WAJIB
              </label>
              <textarea
                value={alasan}
                onChange={(e) => setAlasan(e.target.value)}
                rows={2}
                placeholder={
                  selisih < 0
                    ? "mis: Ibu Ani kembalikan 2 galon"
                    : selisih > 0
                      ? "mis: Pak Anton pinjam 3 galon tambahan"
                      : "mis: koreksi baseline / catat pinjaman lama"
                }
                className="w-full px-3 py-2 border border-line rounded-md text-sm"
              />
            </div>

            {err && (
              <div className="text-xs text-red-600 font-bold">{err}</div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <button
                onClick={onClose}
                disabled={pending}
                className="px-4 py-2 border border-line rounded-md text-sm"
              >
                Batal
              </button>
              <button
                onClick={handleSubmit}
                disabled={pending || !selected || selisih === 0}
                className="px-4 py-2 bg-amber-600 text-white rounded-md text-sm font-bold inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                {pending && <Loader2 size={14} className="animate-spin" />}
                Simpan Adjust
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
