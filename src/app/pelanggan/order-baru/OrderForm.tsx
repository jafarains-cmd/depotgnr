"use client";

import { useMemo, useState, useTransition } from "react";
import { Minus, Plus } from "lucide-react";
import type { Produk } from "@/db/schema/produk";
import { formatRupiah } from "@/lib/utils";
import { createOrder } from "./actions";

type Jenis = "isi_ulang" | "tukar" | "beli_baru";
type LineKey = string; // `${produkId}:${jenis}`

export function OrderForm({
  produkList,
  defaultAlamat,
}: {
  produkList: Produk[];
  defaultAlamat: string;
}) {
  const [qtyMap, setQtyMap] = useState<Record<LineKey, number>>({});
  const [alamatAntar, setAlamatAntar] = useState(defaultAlamat);
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await createOrder({
          items,
          alamatAntar,
          jadwalAntar: jadwalAntar || undefined,
          catatan: catatan || undefined,
          tipePengantaran: pakaiGalonSaya ? "jemput-antar" : "antar-saja",
        });
      } catch (e) {
        // redirect() throws NEXT_REDIRECT — itu sukses, abaikan
        if (e instanceof Error && /NEXT_REDIRECT/.test(e.message)) return;
        setError(e instanceof Error ? e.message : "Gagal");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        {produkList.map((p) => {
          const variants = [
            { jenis: "isi_ulang" as const, label: "Isi Ulang", harga: p.hargaIsiUlang },
            { jenis: "tukar" as const, label: "Tukar Galon", harga: p.hargaTukar },
            { jenis: "beli_baru" as const, label: "Beli Baru", harga: p.hargaBeliBaru },
          ].filter((v) => v.harga > 0);

          return (
            <div key={p.id} className="bg-white border border-slate-200 rounded-xl p-3">
              <div className="font-medium">{p.nama}</div>
              {p.deskripsi && <div className="text-xs text-slate-500 mb-2">{p.deskripsi}</div>}
              <div className="space-y-1.5">
                {variants.map((v) => {
                  const k = `${p.id}:${v.jenis}`;
                  const qty = qtyMap[k] ?? 0;
                  return (
                    <div
                      key={v.jenis}
                      className="flex items-center justify-between text-sm py-1"
                    >
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

      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={pakaiGalonSaya}
            onChange={(e) => setPakaiGalonSaya(e.target.checked)}
            className="mt-1"
          />
          <span className="text-sm">
            <span className="font-medium">Pakai galon saya sendiri</span>
            <span className="block text-xs text-slate-500 mt-0.5">
              Kurir akan jemput galon kosong, isi di depot, lalu antar balik. Cocok untuk
              isi ulang galon merek tertentu.
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
          <label className="block text-sm font-medium mb-1">Catatan (opsional)</label>
          <textarea
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
            placeholder="Mis. titip di pos satpam, jangan lupa galon kosong, dll."
          />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 sticky bottom-16 sm:bottom-0">
        <div className="flex justify-between items-center mb-3">
          <span className="text-slate-600 text-sm">Total Estimasi</span>
          <span className="text-lg font-bold">{formatRupiah(total)}</span>
        </div>
        {error && <div className="text-red-600 text-xs mb-2">{error}</div>}
        <button
          type="submit"
          disabled={pending || items.length === 0 || !alamatAntar.trim()}
          className="w-full py-3 bg-brand-600 text-white font-medium rounded-md disabled:opacity-50"
        >
          {pending ? "Mengirim..." : "Kirim Order"}
        </button>
      </div>
    </form>
  );
}
