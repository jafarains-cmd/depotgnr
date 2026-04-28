"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Trash2, Printer } from "lucide-react";
import type { Produk } from "@/db/schema/produk";
import { formatRupiah } from "@/lib/utils";
import { createTransaksi, type CartItem } from "./actions";

type PelangganOpt = { id: number; nama: string; telp: string | null };
type Jenis = "isi_ulang" | "tukar" | "beli_baru";

export type Preset = {
  refOrderId: number;
  nomorOrder: string;
  pelangganId: number | null;
  cart: CartItem[];
};

export function POSClient({
  produkList,
  pelangganList,
  preset,
}: {
  produkList: Produk[];
  pelangganList: PelangganOpt[];
  preset?: Preset;
}) {
  const [pelangganId, setPelangganId] = useState<number | null>(preset?.pelangganId ?? null);
  const [pelangganQ, setPelangganQ] = useState("");
  const [cart, setCart] = useState<CartItem[]>(preset?.cart ?? []);
  const [diskon, setDiskon] = useState(0);
  const [metodeBayar, setMetodeBayar] = useState<"cash" | "transfer" | "qris">("cash");
  const [catatan, setCatatan] = useState("");
  const [pending, startTransition] = useTransition();
  const [lastNota, setLastNota] = useState<{ id: number; nota: string; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const subtotal = useMemo(
    () => cart.reduce((s, it) => s + it.hargaSatuan * it.qty, 0),
    [cart],
  );
  const total = Math.max(0, subtotal - diskon);

  const filteredPelanggan = pelangganList
    .filter(
      (p) =>
        p.nama.toLowerCase().includes(pelangganQ.toLowerCase()) ||
        (p.telp ?? "").includes(pelangganQ),
    )
    .slice(0, 8);

  function addItem(p: Produk, jenis: Jenis) {
    const harga =
      jenis === "isi_ulang" ? p.hargaIsiUlang : jenis === "tukar" ? p.hargaTukar : p.hargaBeliBaru;
    setCart((c) => {
      const idx = c.findIndex((i) => i.produkId === p.id && i.jenis === jenis);
      if (idx >= 0) {
        const next = [...c];
        next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
        return next;
      }
      return [...c, { produkId: p.id, qty: 1, hargaSatuan: harga, jenis }];
    });
  }

  function setQty(idx: number, qty: number) {
    setCart((c) => c.map((it, i) => (i === idx ? { ...it, qty: Math.max(1, qty) } : it)));
  }
  function removeItem(idx: number) {
    setCart((c) => c.filter((_, i) => i !== idx));
  }

  function handleSimpan() {
    setError(null);
    if (cart.length === 0) {
      setError("Tambahkan item dulu");
      return;
    }
    startTransition(async () => {
      try {
        const res = await createTransaksi({
          pelangganId,
          items: cart,
          diskon,
          metodeBayar,
          catatan: catatan || undefined,
          refOrderId: preset?.refOrderId,
        });
        setLastNota({ id: res.id, nota: res.nomorNota, total: res.total });
        setCart([]);
        setDiskon(0);
        setCatatan("");
        setPelangganId(null);
        setPelangganQ("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Gagal");
      }
    });
  }

  const labelJenis = (j: Jenis) =>
    j === "isi_ulang" ? "Isi Ulang" : j === "tukar" ? "Tukar" : "Beli Baru";

  return (
    <div className="grid lg:grid-cols-5 gap-6">
      {/* Produk picker */}
      <div className="lg:col-span-3 space-y-3">
        <div className="grid sm:grid-cols-2 gap-3">
          {produkList.map((p) => (
            <div key={p.id} className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="font-medium">{p.nama}</div>
              <div className="text-xs text-slate-500 mb-3">{p.deskripsi}</div>
              <div className="space-y-1.5 text-sm">
                {p.hargaIsiUlang > 0 && (
                  <ProdBtn
                    label={`Isi Ulang · ${formatRupiah(p.hargaIsiUlang)}`}
                    onClick={() => addItem(p, "isi_ulang")}
                  />
                )}
                {p.hargaTukar > 0 && (
                  <ProdBtn
                    label={`Tukar · ${formatRupiah(p.hargaTukar)}`}
                    onClick={() => addItem(p, "tukar")}
                  />
                )}
                {p.hargaBeliBaru > 0 && (
                  <ProdBtn
                    label={`Beli Baru · ${formatRupiah(p.hargaBeliBaru)}`}
                    onClick={() => addItem(p, "beli_baru")}
                  />
                )}
              </div>
            </div>
          ))}
          {produkList.length === 0 && (
            <div className="col-span-2 p-6 bg-amber-50 text-amber-800 rounded-xl text-sm">
              Belum ada produk aktif. Tambahkan di Admin → Produk.
            </div>
          )}
        </div>
      </div>

      {/* Cart */}
      <div className="lg:col-span-2 space-y-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-0.5">Pelanggan</label>
            {pelangganId ? (
              <div className="flex justify-between items-center bg-slate-50 px-3 py-2 rounded-md">
                <span className="text-sm">
                  {pelangganList.find((p) => p.id === pelangganId)?.nama ?? "—"}
                </span>
                <button
                  onClick={() => {
                    setPelangganId(null);
                    setPelangganQ("");
                  }}
                  className="text-xs text-slate-500 hover:text-red-600"
                >
                  Ganti
                </button>
              </div>
            ) : (
              <>
                <input
                  value={pelangganQ}
                  onChange={(e) => setPelangganQ(e.target.value)}
                  placeholder="Walk-in atau cari nama/telp..."
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-sm"
                />
                {pelangganQ && (
                  <div className="mt-1 max-h-40 overflow-auto border border-slate-200 rounded-md text-sm">
                    {filteredPelanggan.length === 0 && (
                      <div className="p-2 text-slate-400 text-xs">Tidak ditemukan</div>
                    )}
                    {filteredPelanggan.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          setPelangganId(p.id);
                          setPelangganQ("");
                        }}
                        className="w-full text-left px-2 py-1 hover:bg-slate-50"
                      >
                        {p.nama} <span className="text-xs text-slate-400">{p.telp}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="border-t pt-2 space-y-2">
            <div className="text-xs font-medium text-slate-500">Keranjang</div>
            {cart.length === 0 && <div className="text-xs text-slate-400 py-3">Kosong</div>}
            {cart.map((it, idx) => {
              const p = produkList.find((x) => x.id === it.produkId);
              return (
                <div
                  key={idx}
                  className="flex items-center gap-2 text-sm border-b border-slate-100 pb-2"
                >
                  <div className="flex-1">
                    <div>{p?.nama ?? "?"}</div>
                    <div className="text-xs text-slate-500">
                      {labelJenis(it.jenis)} · {formatRupiah(it.hargaSatuan)}
                    </div>
                  </div>
                  <input
                    type="number"
                    min={1}
                    value={it.qty}
                    onChange={(e) => setQty(idx, Number(e.target.value))}
                    className="w-14 px-2 py-1 border border-slate-300 rounded text-center"
                  />
                  <div className="w-20 text-right text-xs">
                    {formatRupiah(it.hargaSatuan * it.qty)}
                  </div>
                  <button onClick={() => removeItem(idx)} className="text-red-500">
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>

          <div className="border-t pt-3 space-y-2 text-sm">
            <Row label="Subtotal" value={formatRupiah(subtotal)} />
            <div className="flex justify-between items-center">
              <label className="text-slate-600">Diskon</label>
              <input
                type="number"
                min={0}
                value={diskon}
                onChange={(e) => setDiskon(Number(e.target.value))}
                className="w-28 px-2 py-1 border border-slate-300 rounded text-right"
              />
            </div>
            <Row label="Total" value={formatRupiah(total)} bold />

            <div className="grid grid-cols-3 gap-1 text-xs">
              {(["cash", "transfer", "qris"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMetodeBayar(m)}
                  className={`py-1.5 rounded-md uppercase ${
                    metodeBayar === m
                      ? "bg-brand-600 text-white"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            <textarea
              placeholder="Catatan (opsional)"
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              rows={2}
              className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
            />

            {error && <div className="text-red-600 text-xs">{error}</div>}

            <button
              onClick={handleSimpan}
              disabled={pending || cart.length === 0}
              className="w-full py-2.5 bg-brand-600 text-white rounded-md font-medium disabled:opacity-50"
            >
              {pending ? "Menyimpan..." : "Simpan & Bayar"}
            </button>
          </div>
        </div>

        {lastNota && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">✓ {lastNota.nota}</div>
                <div className="text-xs">Total: {formatRupiah(lastNota.total)}</div>
              </div>
              <a
                href={`/kasir/transaksi/${lastNota.id}`}
                target="_blank"
                rel="noopener"
                className="px-3 py-1.5 bg-brand-600 text-white rounded-md inline-flex items-center gap-1 text-xs"
              >
                <Printer size={14} /> Buka Nota
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ProdBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-3 py-1.5 rounded-md bg-slate-50 hover:bg-brand-50 hover:text-brand-700 flex items-center justify-between"
    >
      <span>{label}</span>
      <Plus size={14} />
    </button>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-bold text-base" : "text-slate-600"}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
