"use client";

import { useMemo, useState, useTransition } from "react";
import { Minus, Plus, Search, UserPlus, X } from "lucide-react";
import type { Produk } from "@/db/schema/produk";
import { formatRupiah } from "@/lib/utils";
import { createWalkInOrder, searchPelanggan } from "./actions";

type Jenis = "isi_ulang" | "tukar" | "beli_baru";
type LineKey = string;

type Pel = { id: number; nama: string; telp: string | null; alamat: string | null };

export function OrderBaruClient({ produkList }: { produkList: Produk[] }) {
  const [qtyMap, setQtyMap] = useState<Record<LineKey, number>>({});
  const [pelMode, setPelMode] = useState<"existing" | "baru">("existing");

  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Pel[]>([]);
  const [selected, setSelected] = useState<Pel | null>(null);

  const [namaBaru, setNamaBaru] = useState("");
  const [telpBaru, setTelpBaru] = useState("");

  const [alamatAntar, setAlamatAntar] = useState("");
  const [jadwalAntar, setJadwalAntar] = useState("");
  const [catatan, setCatatan] = useState("");
  const [pakaiGalonSaya, setPakaiGalonSaya] = useState(false);

  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const items = useMemo(
    () =>
      Object.entries(qtyMap)
        .filter(([, qty]) => qty > 0)
        .map(([k, qty]) => {
          const [pidStr, jenis] = k.split(":");
          return { produkId: Number(pidStr), jenis: jenis as Jenis, qty };
        }),
    [qtyMap],
  );

  const total = useMemo(
    () =>
      items.reduce((s, it) => {
        const p = produkList.find((x) => x.id === it.produkId);
        if (!p) return s;
        const h =
          it.jenis === "isi_ulang"
            ? p.hargaIsiUlang
            : it.jenis === "tukar"
              ? p.hargaTukar
              : p.hargaBeliBaru;
        return s + h * it.qty;
      }, 0),
    [items, produkList],
  );

  function setQty(pid: number, jenis: Jenis, delta: number) {
    setQtyMap((m) => {
      const k = `${pid}:${jenis}`;
      const next = Math.max(0, (m[k] ?? 0) + delta);
      const out = { ...m, [k]: next };
      if (next === 0) delete out[k];
      return out;
    });
  }

  function doSearch() {
    startTransition(async () => {
      const r = await searchPelanggan(search);
      setResults(r);
    });
  }

  function pickPel(p: Pel) {
    setSelected(p);
    setResults([]);
    if (p.alamat && !alamatAntar) setAlamatAntar(p.alamat);
  }

  function clearPel() {
    setSelected(null);
    setSearch("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (pelMode === "existing" && !selected) {
      setError("Pilih pelanggan dulu, atau switch ke 'Pelanggan baru'");
      return;
    }
    if (pelMode === "baru" && !namaBaru.trim()) {
      setError("Nama pelanggan baru wajib diisi");
      return;
    }
    if (items.length === 0) {
      setError("Pilih minimal 1 produk");
      return;
    }
    if (!alamatAntar.trim()) {
      setError("Alamat pengantaran wajib diisi");
      return;
    }

    startTransition(async () => {
      try {
        await createWalkInOrder({
          pelangganId: pelMode === "existing" ? selected?.id : undefined,
          pelangganBaru:
            pelMode === "baru"
              ? { nama: namaBaru, telp: telpBaru || undefined, alamat: alamatAntar }
              : undefined,
          items,
          alamatAntar,
          tipePengantaran: pakaiGalonSaya ? "jemput-antar" : "antar-saja",
          jadwalAntar: jadwalAntar || undefined,
          catatan: catatan || undefined,
        });
      } catch (e) {
        if (e instanceof Error && /NEXT_REDIRECT/.test(e.message)) return;
        setError(e instanceof Error ? e.message : "Gagal");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <div className="font-semibold text-sm">Pelanggan</div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setPelMode("existing")}
            className={`flex-1 px-3 py-1.5 rounded text-sm ${
              pelMode === "existing" ? "bg-brand-600 text-white" : "bg-slate-100"
            }`}
          >
            Pelanggan Existing
          </button>
          <button
            type="button"
            onClick={() => {
              setPelMode("baru");
              clearPel();
            }}
            className={`flex-1 px-3 py-1.5 rounded text-sm ${
              pelMode === "baru" ? "bg-brand-600 text-white" : "bg-slate-100"
            }`}
          >
            <UserPlus size={14} className="inline -mt-0.5" /> Pelanggan Baru
          </button>
        </div>

        {pelMode === "existing" && (
          <>
            {selected ? (
              <div className="border border-emerald-200 bg-emerald-50 rounded-md p-2 flex items-start justify-between">
                <div className="text-sm">
                  <div className="font-medium">{selected.nama}</div>
                  {selected.telp && <div className="text-xs text-slate-600">{selected.telp}</div>}
                  {selected.alamat && (
                    <div className="text-xs text-slate-500">{selected.alamat}</div>
                  )}
                </div>
                <button type="button" onClick={clearPel} className="text-slate-400 hover:text-red-600">
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Cari nama / nomor HP"
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-md text-sm"
                  />
                  <button
                    type="button"
                    onClick={doSearch}
                    disabled={pending}
                    className="px-3 bg-slate-200 rounded-md text-sm inline-flex items-center gap-1"
                  >
                    <Search size={14} /> Cari
                  </button>
                </div>
                {results.length > 0 && (
                  <div className="border border-slate-200 rounded-md divide-y divide-slate-100 text-sm">
                    {results.map((r) => (
                      <button
                        type="button"
                        key={r.id}
                        onClick={() => pickPel(r)}
                        className="w-full text-left p-2 hover:bg-slate-50"
                      >
                        <div className="font-medium">{r.nama}</div>
                        <div className="text-xs text-slate-500">
                          {r.telp ?? "-"} · {r.alamat ?? "-"}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {pelMode === "baru" && (
          <div className="space-y-2">
            <input
              value={namaBaru}
              onChange={(e) => setNamaBaru(e.target.value)}
              placeholder="Nama pelanggan"
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              required
            />
            <input
              value={telpBaru}
              onChange={(e) => setTelpBaru(e.target.value)}
              placeholder="Nomor HP / WA (opsional)"
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
            />
            <p className="text-xs text-slate-500">
              Pelanggan akan disimpan tanpa akun. Bisa diberi akun nanti dari menu Pelanggan.
            </p>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <div className="font-semibold text-sm">Item Order</div>
        {produkList.map((p) => {
          const variants = [
            { jenis: "isi_ulang" as const, label: "Isi Ulang", harga: p.hargaIsiUlang },
            { jenis: "tukar" as const, label: "Tukar Galon", harga: p.hargaTukar },
            { jenis: "beli_baru" as const, label: "Beli Baru", harga: p.hargaBeliBaru },
          ].filter((v) => v.harga > 0);

          return (
            <div key={p.id} className="border border-slate-200 rounded-md p-2">
              <div className="font-medium text-sm">{p.nama}</div>
              <div className="space-y-1">
                {variants.map((v) => {
                  const k = `${p.id}:${v.jenis}`;
                  const qty = qtyMap[k] ?? 0;
                  return (
                    <div key={v.jenis} className="flex items-center justify-between text-sm py-1">
                      <div>
                        <div>{v.label}</div>
                        <div className="text-xs text-slate-500">{formatRupiah(v.harga)}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setQty(p.id, v.jenis, -1)}
                          disabled={qty === 0}
                          className="w-8 h-8 rounded-md border border-slate-300 disabled:opacity-30 flex items-center justify-center"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="w-8 text-center">{qty}</span>
                        <button
                          type="button"
                          onClick={() => setQty(p.id, v.jenis, +1)}
                          className="w-8 h-8 rounded-md bg-brand-600 text-white flex items-center justify-center"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={pakaiGalonSaya}
            onChange={(e) => setPakaiGalonSaya(e.target.checked)}
            className="mt-1"
          />
          <span className="text-sm">
            <span className="font-medium">Pakai galon pelanggan (jemput-isi-antar)</span>
            <span className="block text-xs text-slate-500 mt-0.5">
              Kurir jemput galon kosong → isi di depot → antar balik.
            </span>
          </span>
        </label>
        <div>
          <label className="block text-sm font-medium mb-1">Alamat Pengantaran</label>
          <textarea
            value={alamatAntar}
            onChange={(e) => setAlamatAntar(e.target.value)}
            required
            rows={2}
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Jadwal Antar (opsional)</label>
          <input
            type="datetime-local"
            value={jadwalAntar}
            onChange={(e) => setJadwalAntar(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Catatan</label>
          <textarea
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 sticky bottom-0">
        <div className="flex justify-between items-center mb-3">
          <span className="text-slate-600 text-sm">Total Estimasi</span>
          <span className="text-lg font-bold">{formatRupiah(total)}</span>
        </div>
        {error && <div className="text-red-600 text-xs mb-2">{error}</div>}
        <button
          type="submit"
          disabled={pending}
          className="w-full py-3 bg-brand-600 text-white font-medium rounded-md disabled:opacity-50"
        >
          {pending ? "Mengirim..." : "Buat Order"}
        </button>
      </div>
    </form>
  );
}
