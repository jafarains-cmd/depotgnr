"use client";

import { useMemo, useState, useTransition } from "react";
import { Minus, Plus, MapPin, Clock, MessageSquare, Truck } from "lucide-react";
import type { Produk } from "@/db/schema/produk";
import { formatRupiah } from "@/lib/utils";
import { GallonArt } from "@/components/GallonArt";
import { createOrder } from "./actions";

type Jenis = "isi_ulang" | "tukar" | "beli_baru";
type LineKey = string;

const JENIS_LABEL: Record<Jenis, string> = {
  isi_ulang: "Isi Ulang",
  tukar: "Tukar Galon",
  beli_baru: "Beli Baru",
};

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

  const totalQty = items.reduce((s, it) => s + it.qty, 0);
  // Hanya tampilkan opsi 'pakai galon saya sendiri' kalau ada item isi_ulang.
  // Tukar/beli baru → galon dari depot, jadi tidak perlu jemput.
  const hasIsiUlang = items.some((it) => it.jenis === "isi_ulang");
  // Auto-uncheck kalau cart tidak ada isi_ulang lagi
  const effectivePakaiGalonSaya = hasIsiUlang && pakaiGalonSaya;

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
          tipePengantaran: effectivePakaiGalonSaya ? "jemput-antar" : "antar-saja",
        });
      } catch (e) {
        if (e instanceof Error && /NEXT_REDIRECT/.test(e.message)) return;
        setError(e instanceof Error ? e.message : "Gagal");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pb-32 sm:pb-4">
      {/* Section: Pilih produk */}
      <section>
        <div className="text-[11px] font-bold tracking-widest text-[color:var(--muted)] mb-2 px-1">
          PILIH PRODUK
        </div>
        <div className="space-y-2">
          {produkList.map((p, idx) => {
            const variants = (
              [
                { jenis: "isi_ulang" as const, harga: p.hargaIsiUlang },
                { jenis: "tukar" as const, harga: p.hargaTukar },
                { jenis: "beli_baru" as const, harga: p.hargaBeliBaru },
              ] as const
            ).filter((v) => v.harga > 0);

            const tier = idx % 3 === 0 ? "standard" : idx % 3 === 1 ? "premium" : "ro";

            return (
              <div
                key={p.id}
                className="bg-surface border border-line rounded-2xl p-4"
              >
                <div className="flex gap-3 mb-3">
                  <div className="w-16 h-20 rounded-xl bg-[color:var(--surface2)] grid place-items-center flex-shrink-0">
                    <GallonArt size={50} tier={tier as "standard" | "premium" | "ro"} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold">{p.nama}</div>
                    {p.deskripsi && (
                      <div className="text-xs text-[color:var(--muted)] mt-0.5">{p.deskripsi}</div>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  {variants.map((v) => {
                    const k = `${p.id}:${v.jenis}`;
                    const qty = qtyMap[k] ?? 0;
                    return (
                      <div
                        key={v.jenis}
                        className="flex items-center justify-between py-2 px-3 rounded-xl bg-[color:var(--surface2)]"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-semibold">{JENIS_LABEL[v.jenis]}</div>
                          <div className="text-xs text-brand font-bold">
                            {formatRupiah(v.harga)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => setQty(p.id, v.jenis, -1)}
                            disabled={qty === 0}
                            className="w-9 h-9 rounded-xl border-2 border-line bg-surface text-ink disabled:opacity-30 flex items-center justify-center transition active:scale-95"
                          >
                            <Minus size={16} />
                          </button>
                          <span className="w-8 text-center font-bold">{qty}</span>
                          <button
                            type="button"
                            onClick={() => setQty(p.id, v.jenis, +1)}
                            className="w-9 h-9 rounded-xl bg-brand text-white flex items-center justify-center transition active:scale-95 shadow-sm"
                          >
                            <Plus size={16} strokeWidth={2.5} />
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
      </section>

      {/* Section: Pengantaran */}
      <section>
        <div className="text-[11px] font-bold tracking-widest text-[color:var(--muted)] mb-2 px-1">
          PENGANTARAN
        </div>
        <div className="bg-surface border border-line rounded-2xl p-4 space-y-3">
          {hasIsiUlang && (
            <label className="flex items-start gap-3 cursor-pointer p-3 -mx-1 rounded-xl bg-[color:var(--surface2)]">
              <input
                type="checkbox"
                checked={pakaiGalonSaya}
                onChange={(e) => setPakaiGalonSaya(e.target.checked)}
                className="mt-0.5 accent-[color:var(--brand)]"
              />
              <span className="text-sm">
                <span className="font-bold inline-flex items-center gap-1.5">
                  <Truck size={14} className="text-brand" />
                  Pakai galon saya sendiri
                </span>
                <span className="block text-xs text-[color:var(--muted)] mt-0.5">
                  Kurir jemput → isi di depot → antar balik. Cocok galon merek tertentu.
                </span>
              </span>
            </label>
          )}

          <div>
            <label className="text-xs font-bold text-[color:var(--muted)] mb-1.5 inline-flex items-center gap-1.5">
              <MapPin size={12} /> ALAMAT PENGANTARAN
            </label>
            <textarea
              value={alamatAntar}
              onChange={(e) => setAlamatAntar(e.target.value)}
              required
              rows={2}
              className="w-full px-3 py-2.5 bg-[color:var(--surface2)] border-2 border-transparent focus:border-brand rounded-xl text-sm outline-none transition"
              placeholder="Jl. Contoh No.123, RT/RW, Kelurahan, Kecamatan"
            />
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="text-xs font-bold text-[color:var(--muted)] mb-1.5 inline-flex items-center gap-1.5">
                <Clock size={12} />{" "}
                {effectivePakaiGalonSaya
                  ? "JADWAL PENJEMPUTAN (OPSIONAL)"
                  : "JADWAL PENGANTARAN (OPSIONAL)"}
              </label>
              <input
                type="datetime-local"
                value={jadwalAntar}
                onChange={(e) => setJadwalAntar(e.target.value)}
                className="w-full px-3 py-2.5 bg-[color:var(--surface2)] border-2 border-transparent focus:border-brand rounded-xl text-sm outline-none transition"
              />
              <p className="text-[10px] text-[color:var(--muted)] mt-1">
                {effectivePakaiGalonSaya
                  ? "Kapan kurir datang ambil galon kosong Anda. Kosongkan = secepatnya."
                  : "Kapan Anda ingin galon diantar. Kosongkan = secepatnya."}
              </p>
            </div>
            <div>
              <label className="text-xs font-bold text-[color:var(--muted)] mb-1.5 inline-flex items-center gap-1.5">
                <MessageSquare size={12} /> CATATAN (OPSIONAL)
              </label>
              <textarea
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
                rows={2}
                className="w-full px-3 py-2.5 bg-[color:var(--surface2)] border-2 border-transparent focus:border-brand rounded-xl text-sm outline-none transition"
                placeholder="Mis. titip di pos satpam, telp dulu, dll."
              />
            </div>
          </div>
        </div>
      </section>

      {/* Sticky checkout bar */}
      <div className="fixed sm:sticky bottom-16 sm:bottom-4 left-0 right-0 sm:left-auto sm:right-auto z-30 px-4 sm:px-0">
        <div className="bg-surface border border-line rounded-2xl p-4 max-w-3xl mx-auto shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-[11px] text-[color:var(--muted)] font-semibold">
                {totalQty > 0 ? `${totalQty} galon · Total estimasi` : "Pilih produk dulu"}
              </div>
              <div className="text-2xl font-extrabold text-brand leading-tight">
                {formatRupiah(total)}
              </div>
            </div>
          </div>
          {error && (
            <div className="text-[color:var(--accent2)] text-xs mb-2 font-semibold">{error}</div>
          )}
          <button
            type="submit"
            disabled={pending || items.length === 0 || !alamatAntar.trim()}
            className="w-full py-3.5 bg-brand text-white font-extrabold rounded-2xl disabled:opacity-40 transition active:scale-[0.98] inline-flex items-center justify-center gap-2"
          >
            {pending ? "Mengirim..." : "Kirim Order"}
            {!pending && <Truck size={18} />}
          </button>
        </div>
      </div>
    </form>
  );
}
