"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Plus, Trash2, Printer } from "lucide-react";
import type { Produk } from "@/db/schema/produk";
import { formatRupiah } from "@/lib/utils";
import { createTransaksi, getSaldoGalonPinjamForPOS, type CartItem } from "./actions";
import { useToast } from "@/components/Toast";

type PelangganOpt = {
  id: number;
  nama: string;
  telp: string | null;
  alamat: string | null;
  saldoLoyalti: number;
};
type KurirOpt = { id: string; name: string };
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
  kurirList,
  preset,
}: {
  produkList: Produk[];
  pelangganList: PelangganOpt[];
  kurirList: KurirOpt[];
  preset?: Preset;
}) {
  const [pelangganId, setPelangganId] = useState<number | null>(preset?.pelangganId ?? null);
  const [pelangganQ, setPelangganQ] = useState("");
  const [cart, setCart] = useState<CartItem[]>(preset?.cart ?? []);
  const [diskon, setDiskon] = useState(0);
  const [redeemGalon, setRedeemGalon] = useState(0);
  const [metodeBayar, setMetodeBayar] = useState<"cash" | "transfer" | "qris" | "piutang">("cash");
  const [pengantaran, setPengantaran] = useState<"pickup" | "antar">("pickup");
  const [alamatAntar, setAlamatAntar] = useState("");
  const [jadwalAntar, setJadwalAntar] = useState("");
  const [kurirUserId, setKurirUserId] = useState<string>("");
  const [catatan, setCatatan] = useState("");
  const [galonPinjamTambah, setGalonPinjamTambah] = useState(0);
  const [galonKembalikan, setGalonKembalikan] = useState(0);
  const [saldoGalonPinjam, setSaldoGalonPinjam] = useState<{
    total: number;
    saldoTitip: number;
    perProduk: Array<{ produkId: number; namaProduk: string; jumlah: number }>;
  } | null>(null);
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const [lastNota, setLastNota] = useState<{ id: number; nota: string; total: number } | null>(null);
  const [pendingPayment, setPendingPayment] = useState<{
    orderId: number;
    nomorOrder: string;
    total: number;
    payUrl: string;
    metode: string;
    pengantaran: "pickup" | "antar";
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const subtotal = useMemo(
    () => cart.reduce((s, it) => s + it.hargaSatuan * it.qty, 0),
    [cart],
  );
  // Reset redeem saat pelanggan/metode/cart berubah
  useEffect(() => {
    setRedeemGalon(0);
  }, [pelangganId, metodeBayar, cart.length]);

  // Fetch saldo galon depot dipinjam saat pelanggan berubah
  useEffect(() => {
    if (!pelangganId) {
      setSaldoGalonPinjam(null);
      return;
    }
    let cancelled = false;
    getSaldoGalonPinjamForPOS(pelangganId)
      .then((res) => {
        if (!cancelled) setSaldoGalonPinjam(res);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pelangganId]);

  // Reset field galon pinjam saat pelanggan berubah
  useEffect(() => {
    setGalonPinjamTambah(0);
    setGalonKembalikan(0);
  }, [pelangganId]);

  const totalSebelumRedeem = Math.max(0, subtotal - diskon);
  const totalQty = cart.reduce((s, it) => s + it.qty, 0);
  const hargaPerGalon = totalQty > 0 ? Math.round(subtotal / totalQty) : 0;
  const pelSelected = pelangganList.find((p) => p.id === pelangganId);
  const saldoLoyalti = pelSelected?.saldoLoyalti ?? 0;
  const maxGalonRedeem =
    metodeBayar === "cash" && pelangganId && hargaPerGalon > 0
      ? Math.min(totalQty, Math.floor(saldoLoyalti / hargaPerGalon))
      : 0;
  const galonRedeemAktif = Math.max(0, Math.min(redeemGalon, maxGalonRedeem));
  const redeemAktif = galonRedeemAktif * hargaPerGalon;
  const total = Math.max(0, totalSebelumRedeem - redeemAktif);
  const galonForEarn = Math.max(0, totalQty - galonRedeemAktif);

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

  const isGalonOnlyMode =
    cart.length === 0 &&
    pengantaran === "pickup" &&
    (galonPinjamTambah > 0 || galonKembalikan > 0);

  function handleSimpan() {
    setError(null);
    if (cart.length === 0) {
      if (!isGalonOnlyMode) {
        setError("Tambahkan item dulu, atau isi 'Galon Depot' untuk catat pergerakan saja");
        return;
      }
      if (!pelangganId) {
        setError("Catat galon depot tanpa transaksi butuh pelanggan terdaftar");
        return;
      }
    }
    if (metodeBayar === "piutang" && !pelangganId) {
      setError("Bayar nanti (piutang) wajib pilih pelanggan terdaftar");
      return;
    }
    const pelAlamat = pelangganList.find((p) => p.id === pelangganId)?.alamat?.trim() ?? "";
    if (pengantaran === "antar" && !alamatAntar.trim() && !pelAlamat) {
      setError("Antar ke alamat: isi alamat (atau pilih pelanggan yang sudah punya alamat tersimpan)");
      return;
    }
    startTransition(async () => {
      try {
        const res = await createTransaksi({
          pelangganId,
          items: cart,
          diskon,
          metodeBayar,
          pengantaran,
          alamatAntar: pengantaran === "antar" ? alamatAntar.trim() || undefined : undefined,
          jadwalAntar: pengantaran === "antar" && jadwalAntar ? jadwalAntar : undefined,
          kurirUserId: pengantaran === "antar" && kurirUserId ? kurirUserId : undefined,
          catatan: catatan || undefined,
          refOrderId: preset?.refOrderId,
          redeemLoyalti: redeemAktif > 0 ? redeemAktif : undefined,
          // Galon depot hanya untuk pickup; kalau antar, kurir yang input nanti
          galonPinjamTambah: pengantaran === "pickup" ? galonPinjamTambah : 0,
          galonKembalikan: pengantaran === "pickup" ? galonKembalikan : 0,
        });
        if (res.type === "transaksi") {
          setLastNota({ id: res.id, nota: res.nomorNota, total: res.total });
        } else if (res.type === "order") {
          setPendingPayment({
            orderId: res.orderId,
            nomorOrder: res.nomorOrder,
            total: res.total,
            payUrl: res.payUrl,
            metode: metodeBayar,
            pengantaran,
          });
        } else if (res.type === "galon-only") {
          toast.show(
            `✓ Galon depot ${res.pinjam > 0 ? `pinjam +${res.pinjam}` : ""}${res.pinjam > 0 && res.kembali > 0 ? ", " : ""}${res.kembali > 0 ? `kembali ${res.kembali}` : ""}`.trim(),
          );
        }
        setCart([]);
        setDiskon(0);
        setRedeemGalon(0);
        setCatatan("");
        setPelangganId(null);
        setPelangganQ("");
        setAlamatAntar("");
        setJadwalAntar("");
        setKurirUserId("");
        setPengantaran("pickup");
        setMetodeBayar("cash");
        setGalonPinjamTambah(0);
        setGalonKembalikan(0);
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
            <div key={p.id} className="bg-surface rounded-xl border border-line p-4">
              <div className="font-medium">{p.nama}</div>
              <div className="text-xs text-[color:var(--muted)] mb-3">{p.deskripsi}</div>
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
        <div className="bg-surface rounded-xl border border-line p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-[color:var(--muted)] mb-0.5">Pelanggan</label>
            {pelangganId ? (() => {
              const pel = pelangganList.find((p) => p.id === pelangganId);
              const saldo = pel?.saldoLoyalti ?? 0;
              const pinjam = saldoGalonPinjam?.total ?? 0;
              const titip = saldoGalonPinjam?.saldoTitip ?? 0;
              return (
                <div className="bg-[color:var(--surface2)] px-3 py-2 rounded-md space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">{pel?.nama ?? "—"}</span>
                    <button
                      onClick={() => {
                        setPelangganId(null);
                        setPelangganQ("");
                      }}
                      className="text-xs text-[color:var(--muted)] hover:text-red-600"
                    >
                      Ganti
                    </button>
                  </div>
                  <div
                    className={`text-[11px] inline-flex items-center gap-1 ${
                      saldo > 0 ? "text-emerald-700 font-bold" : "text-[color:var(--muted)]"
                    }`}
                  >
                    💎 Saldo Loyalti: <b>{formatRupiah(saldo)}</b>
                    {saldo > 0 && (
                      <span className="text-[10px] text-[color:var(--muted)] font-normal">
                        — tanya pelanggan apakah ingin digunakan
                      </span>
                    )}
                  </div>
                  {/* Info galon: pinjam (depot di pelanggan) + titip (pelanggan di depot) */}
                  <div className="flex flex-wrap gap-1.5 items-center text-[10px]">
                    {pinjam > 0 ? (
                      <span
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold"
                        title="Galon milik depot yang sedang dipegang pelanggan"
                      >
                        🚛 Pinjam: {pinjam} galon
                      </span>
                    ) : (
                      <a
                        href={`/data-pelanggan/${pelangganId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-line text-[color:var(--muted)] hover:border-amber-300 hover:text-amber-700"
                        title="Catat pinjaman galon awal pelanggan"
                      >
                        🚛 Pinjam: 0 galon · + Baseline
                      </a>
                    )}
                    {titip > 0 && (
                      <span
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 font-bold"
                        title="Galon milik pelanggan yang dititipkan di depot"
                      >
                        💧 Titip: {titip} galon
                      </span>
                    )}
                    {pinjam > 0 && (
                      <a
                        href={`/data-pelanggan/${pelangganId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-[color:var(--muted)] hover:underline"
                      >
                        Detail →
                      </a>
                    )}
                  </div>
                </div>
              );
            })() : (
              <>
                <input
                  value={pelangganQ}
                  onChange={(e) => setPelangganQ(e.target.value)}
                  placeholder="Walk-in atau cari nama/telp..."
                  className="w-full px-2.5 py-1.5 border border-line rounded-md text-sm"
                />
                {pelangganQ && (
                  <div className="mt-1 max-h-40 overflow-auto border border-line rounded-md text-sm">
                    {filteredPelanggan.length === 0 && (
                      <div className="p-2 text-[color:var(--muted)] text-xs">Tidak ditemukan</div>
                    )}
                    {filteredPelanggan.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          setPelangganId(p.id);
                          setPelangganQ("");
                        }}
                        className="w-full text-left px-2 py-1 hover:bg-[color:var(--surface2)] flex items-center justify-between gap-2"
                      >
                        <span>
                          {p.nama}{" "}
                          <span className="text-xs text-[color:var(--muted)]">{p.telp}</span>
                        </span>
                        {p.saldoLoyalti > 0 && (
                          <span className="text-[10px] text-emerald-700 font-bold whitespace-nowrap">
                            💎 {formatRupiah(p.saldoLoyalti)}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="border-t pt-2 space-y-2">
            <div className="text-xs font-medium text-[color:var(--muted)]">Keranjang</div>
            {cart.length === 0 && <div className="text-xs text-[color:var(--muted)] py-3">Kosong</div>}
            {cart.map((it, idx) => {
              const p = produkList.find((x) => x.id === it.produkId);
              return (
                <div
                  key={idx}
                  className="flex items-center gap-2 text-sm border-b border-line pb-2"
                >
                  <div className="flex-1">
                    <div>{p?.nama ?? "?"}</div>
                    <div className="text-xs text-[color:var(--muted)]">
                      {labelJenis(it.jenis)} · {formatRupiah(it.hargaSatuan)}
                    </div>
                  </div>
                  <input
                    type="number"
                    min={1}
                    value={it.qty}
                    onChange={(e) => setQty(idx, Number(e.target.value))}
                    className="w-14 px-2 py-1 border border-line rounded text-center"
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
              <label className="text-[color:var(--muted)]">Diskon</label>
              <input
                type="number"
                min={0}
                value={diskon}
                onChange={(e) => setDiskon(Number(e.target.value))}
                className="w-28 px-2 py-1 border border-line rounded text-right"
              />
            </div>
            {pelangganId && saldoLoyalti > 0 && metodeBayar === "cash" && totalSebelumRedeem > 0 && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-md p-2 space-y-1.5">
                <div className="flex justify-between items-center gap-2">
                  <label className="text-xs text-emerald-800 font-bold inline-flex items-center gap-1">
                    💎 Pakai Loyalti
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      max={maxGalonRedeem}
                      step={1}
                      value={redeemGalon}
                      onChange={(e) => setRedeemGalon(Math.max(0, Math.floor(Number(e.target.value))))}
                      className="w-16 px-2 py-1 border border-emerald-300 rounded text-right text-xs bg-white"
                    />
                    <span className="text-[10px] text-emerald-800 font-bold">galon</span>
                    <button
                      type="button"
                      onClick={() => setRedeemGalon(maxGalonRedeem)}
                      disabled={maxGalonRedeem === 0}
                      className="text-[10px] px-1.5 py-1 bg-emerald-600 text-white rounded font-bold disabled:opacity-50"
                      title="Pakai maksimum"
                    >
                      MAX
                    </button>
                  </div>
                </div>
                <div className="text-[10px] text-emerald-700 space-y-0.5">
                  <div>
                    Saldo {formatRupiah(saldoLoyalti)} · Harga rata-rata Rp {hargaPerGalon.toLocaleString("id-ID")}/galon
                  </div>
                  <div>
                    Maks bisa redeem: <b>{maxGalonRedeem} galon</b>
                    {maxGalonRedeem > 0 && (
                      <span> ({formatRupiah(maxGalonRedeem * hargaPerGalon)})</span>
                    )}
                  </div>
                </div>
                {galonRedeemAktif > 0 && (
                  <div className="text-[10px] text-emerald-900 font-bold border-t border-emerald-200 pt-1.5">
                    {galonRedeemAktif} galon × Rp {hargaPerGalon.toLocaleString("id-ID")} ={" "}
                    {formatRupiah(redeemAktif)} dari loyalty
                    <div className="font-normal mt-0.5">
                      {total === 0
                        ? "✓ Tidak perlu bayar tunai"
                        : `Sisa bayar tunai: ${formatRupiah(total)}`}
                    </div>
                    <div className="text-[9px] text-amber-700 mt-0.5">
                      ⓘ Earn poin hanya dari {galonForEarn} galon yang dibayar tunai
                    </div>
                  </div>
                )}
                {maxGalonRedeem === 0 && (
                  <div className="text-[10px] text-[color:var(--muted)]">
                    Saldo belum cukup untuk 1 galon ({formatRupiah(hargaPerGalon)}).
                  </div>
                )}
              </div>
            )}
            <Row label="Total Bayar" value={formatRupiah(total)} bold />

            <div>
              <div className="text-[10px] font-bold tracking-widest text-[color:var(--muted)] mb-1">
                PENGANTARAN
              </div>
              <div className="grid grid-cols-2 gap-1 text-xs">
                {(
                  [
                    { v: "pickup", label: "Ambil di depot" },
                    { v: "antar", label: "Antar ke alamat" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.v}
                    onClick={() => setPengantaran(opt.v)}
                    className={`py-1.5 rounded-md ${
                      pengantaran === opt.v
                        ? "bg-brand-600 text-white"
                        : "bg-[color:var(--surface2)] text-[color:var(--muted)]"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {pengantaran === "antar" && (() => {
              const pel = pelangganList.find((p) => p.id === pelangganId);
              const alamatTersimpan = pel?.alamat?.trim() ?? "";
              return (
                <div className="space-y-2 bg-[color:var(--surface2)] rounded-md p-2">
                  {alamatTersimpan && (
                    <div className="text-[10px] text-emerald-700 bg-emerald-50 rounded px-2 py-1">
                      📍 Alamat pelanggan: <b>{alamatTersimpan}</b>
                      <div className="text-[10px] text-[color:var(--muted)] mt-0.5">
                        Kosongkan kolom di bawah untuk pakai alamat ini.
                      </div>
                    </div>
                  )}
                  <textarea
                    value={alamatAntar}
                    onChange={(e) => setAlamatAntar(e.target.value)}
                    placeholder={
                      alamatTersimpan
                        ? "Alamat antar (kosongkan = pakai alamat pelanggan)"
                        : "Alamat antar (wajib)"
                    }
                    rows={2}
                    className="w-full px-2 py-1 border border-line rounded text-xs bg-surface"
                  />
                  <input
                    type="datetime-local"
                    value={jadwalAntar}
                    onChange={(e) => setJadwalAntar(e.target.value)}
                    className="w-full px-2 py-1 border border-line rounded text-xs bg-surface"
                  />
                  <select
                    value={kurirUserId}
                    onChange={(e) => setKurirUserId(e.target.value)}
                    className="w-full px-2 py-1 border border-line rounded text-xs bg-surface"
                  >
                    <option value="">— Kurir: belum di-assign (admin pilih nanti) —</option>
                    {kurirList.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.name}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })()}

            <div>
              <div className="text-[10px] font-bold tracking-widest text-[color:var(--muted)] mb-1">
                PEMBAYARAN
              </div>
              <div className="grid grid-cols-4 gap-1 text-xs">
                {(["cash", "transfer", "qris", "piutang"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMetodeBayar(m)}
                    className={`py-1.5 rounded-md uppercase ${
                      metodeBayar === m
                        ? m === "piutang"
                          ? "bg-amber-600 text-white"
                          : "bg-brand-600 text-white"
                        : "bg-[color:var(--surface2)] text-[color:var(--muted)]"
                    }`}
                  >
                    {m === "piutang" ? "Nanti" : m}
                  </button>
                ))}
              </div>
              {metodeBayar === "piutang" && (
                <div className="text-[10px] text-amber-700 mt-1">
                  ⚠ Pelanggan ambil/terima galon, bayar nanti. Wajib pelanggan terdaftar.
                </div>
              )}
            </div>

            {/* Antar: input galon dilakukan kurir di halaman konfirmasi antar */}
            {pengantaran === "antar" && pelangganId && (
              <div className="text-[11px] bg-[color:var(--surface2)] border border-line text-[color:var(--muted)] rounded-md p-2">
                {saldoGalonPinjam && saldoGalonPinjam.total > 0 ? (
                  <>
                    ℹ Pelanggan sedang pegang <b>{saldoGalonPinjam.total} galon depot</b>.{" "}
                  </>
                ) : null}
                Pencatatan galon depot dilakukan kurir saat upload bukti antar di halaman <code>/kurir/[order]</code>.
              </div>
            )}
            {/* Galon depot dipinjam — hanya untuk pickup, antar diinput kurir */}
            {pengantaran === "pickup" && pelangganId && (
              <div className="border border-line rounded-md p-2 space-y-1.5 bg-[color:var(--surface2)]">
                {saldoGalonPinjam && saldoGalonPinjam.total > 0 && (
                  <div className="text-[11px] bg-amber-50 border border-amber-200 text-amber-800 rounded p-1.5">
                    ⚠ Pelanggan ini sedang pegang <b>{saldoGalonPinjam.total} galon depot</b>
                  </div>
                )}
                {isGalonOnlyMode && (
                  <div className="text-[11px] bg-sky-50 border border-sky-200 text-sky-800 rounded p-1.5">
                    Mode catat galon saja (tanpa transaksi). Klik tombol di bawah untuk simpan.
                  </div>
                )}
                <div className="text-[10px] text-[color:var(--muted)] uppercase font-bold">
                  Galon Depot (opsional)
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <label className="text-[11px]">
                    <span className="text-[color:var(--muted)]">Pinjam tambah</span>
                    <input
                      type="number"
                      min={0}
                      value={galonPinjamTambah}
                      onChange={(e) => setGalonPinjamTambah(Math.max(0, Number(e.target.value) || 0))}
                      className="w-full px-2 py-1 border border-line rounded text-xs"
                    />
                  </label>
                  <label className="text-[11px]">
                    <span className="text-[color:var(--muted)]">Dikembalikan</span>
                    <input
                      type="number"
                      min={0}
                      value={galonKembalikan}
                      onChange={(e) => setGalonKembalikan(Math.max(0, Number(e.target.value) || 0))}
                      className="w-full px-2 py-1 border border-line rounded text-xs"
                    />
                  </label>
                </div>
                {(galonPinjamTambah > 0 || galonKembalikan > 0) && (() => {
                  const saldoLama = saldoGalonPinjam?.total ?? 0;
                  const saldoBaru = Math.max(0, saldoLama + galonPinjamTambah - galonKembalikan);
                  return (
                    <div className="text-[10px] text-[color:var(--muted)] pt-1 border-t border-line">
                      Saldo galon dipinjam: <b className="text-ink">{saldoLama}</b> →{" "}
                      <b className="text-amber-700">{saldoBaru}</b> setelah disimpan
                    </div>
                  );
                })()}
              </div>
            )}

            <textarea
              placeholder="Catatan (opsional)"
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              rows={2}
              className="w-full px-2 py-1 border border-line rounded text-xs"
            />

            {error && <div className="text-red-600 text-xs">{error}</div>}

            <button
              onClick={handleSimpan}
              disabled={pending || (cart.length === 0 && !isGalonOnlyMode)}
              className="w-full py-2.5 bg-brand-600 text-white rounded-md font-medium disabled:opacity-50"
            >
              {pending
                ? "Menyimpan..."
                : isGalonOnlyMode
                  ? "Catat Galon Depot"
                  : "Simpan & Bayar"}
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

        {pendingPayment && (() => {
          const isOnline = pendingPayment.metode === "transfer" || pendingPayment.metode === "qris";
          const isPiutang = pendingPayment.metode === "piutang";
          const isCashAntar =
            pendingPayment.metode === "cash" && pendingPayment.pengantaran === "antar";

          // Tentukan teks/warna/CTA per skenario
          const config = isOnline
            ? {
                color: "amber",
                badge: `MENUNGGU BUKTI · ${pendingPayment.metode.toUpperCase()}`,
                desc: "Pelanggan upload bukti bayar di link ini. Setelah upload, konfirmasi di halaman Pembayaran.",
                primaryLabel: "Buka Halaman Bayar →",
                showSalin: true,
              }
            : isPiutang
              ? {
                  color: "amber",
                  badge: "PIUTANG TERCATAT",
                  desc:
                    pendingPayment.pengantaran === "antar"
                      ? "Order antar dibuat sebagai piutang. Tagih saat barang sampai atau setelahnya di Pembayaran."
                      : "Galon sudah diserahkan. Tagih nanti & tandai lunas di Pembayaran.",
                  primaryLabel: "Lihat di Piutang →",
                  showSalin: false,
                }
              : isCashAntar
                ? {
                    color: "emerald",
                    badge: "ORDER ANTAR · LUNAS",
                    desc: "Pelanggan sudah bayar cash. Order masuk antrian kurir untuk diantar.",
                    primaryLabel: "Lihat di Order →",
                    showSalin: false,
                  }
                : {
                    color: "amber",
                    badge: `MENUNGGU PEMBAYARAN · ${pendingPayment.metode.toUpperCase()}`,
                    desc: "Order tersimpan. Lanjut ke halaman pembayaran.",
                    primaryLabel: "Buka →",
                    showSalin: false,
                  };

          const bg = config.color === "emerald" ? "bg-emerald-50 border-emerald-300" : "bg-amber-50 border-amber-300";
          const text = config.color === "emerald" ? "text-emerald-800" : "text-amber-800";
          const text2 = config.color === "emerald" ? "text-emerald-900" : "text-amber-900";
          const btnPrimary = config.color === "emerald" ? "bg-emerald-600" : "bg-brand-600";

          return (
            <div className={`${bg} border-2 rounded-xl p-4 text-sm space-y-2`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className={`text-[10px] font-bold tracking-widest ${text}`}>
                    {config.badge}
                  </div>
                  <div className={`font-extrabold ${text2} mt-0.5`}>
                    {pendingPayment.nomorOrder}
                  </div>
                  <div className={`${text2} mt-1`}>
                    Total: <b>{formatRupiah(pendingPayment.total)}</b>
                  </div>
                  <div className={`text-xs ${text} mt-2`}>{config.desc}</div>
                </div>
                <button
                  onClick={() => setPendingPayment(null)}
                  className={`${text} hover:${text2} text-xs font-bold`}
                >
                  ✕ Tutup
                </button>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <a
                  href={pendingPayment.payUrl}
                  target={isOnline ? "_blank" : undefined}
                  rel={isOnline ? "noopener" : undefined}
                  className={`px-3 py-2 ${btnPrimary} text-white rounded-md text-xs font-bold`}
                >
                  {config.primaryLabel}
                </a>
                {config.showSalin && (
                  <button
                    onClick={async () => {
                      const url = `${window.location.origin}${pendingPayment.payUrl}`;
                      await navigator.clipboard.writeText(url);
                      toast.success("Link tersalin. Kirim ke pelanggan lewat WA.");
                    }}
                    className="px-3 py-2 bg-amber-200 text-amber-900 rounded-md text-xs font-bold"
                  >
                    Salin Link
                  </button>
                )}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

function ProdBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-3 py-1.5 rounded-md bg-[color:var(--surface2)] hover:bg-brand-50 hover:text-brand-700 flex items-center justify-between"
    >
      <span>{label}</span>
      <Plus size={14} />
    </button>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-bold text-base" : "text-[color:var(--muted)]"}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
