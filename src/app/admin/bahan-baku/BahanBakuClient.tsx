"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Loader2,
  ArrowDownToLine,
  ArrowUpFromLine,
  Power,
  PowerOff,
  AlertTriangle,
  History,
} from "lucide-react";
import {
  saveBahanBaku,
  deleteBahanBaku,
  toggleBahanAktif,
  catatMutasi,
} from "./actions";
import { formatRupiah } from "@/lib/utils";
import { useFormatTanggal } from "@/components/TimezoneContext";

export type BahanItem = {
  id: number;
  nama: string;
  satuan: string;
  stok: number;
  threshold: number;
  hargaSatuan: number;
  aktif: boolean;
  catatan: string | null;
};

export type MutasiRow = {
  id: number;
  bahanId: number;
  bahanNama: string;
  satuan: string;
  perubahan: number;
  alasan: string;
  biaya: number;
  catatan: string | null;
  createdAt: string;
  userName: string | null;
};

export function BahanBakuClient({
  items,
  recentMutasi,
}: {
  items: BahanItem[];
  recentMutasi: MutasiRow[];
}) {
  const fmt = useFormatTanggal();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<BahanItem | null>(null);
  const [mutasiFor, setMutasiFor] = useState<{ item: BahanItem; arah: "in" | "out" } | null>(
    null,
  );

  const aktifItems = items.filter((i) => i.aktif);
  const lowStockCount = aktifItems.filter((i) => i.stok <= i.threshold && i.threshold > 0)
    .length;
  const totalNilai = aktifItems.reduce((s, i) => s + i.stok * i.hargaSatuan, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card label="ITEM AKTIF" value={`${aktifItems.length}`} bg="bg-surface" />
        <Card
          label="STOK MENIPIS"
          value={`${lowStockCount}`}
          bg={lowStockCount > 0 ? "bg-rose-50 border-rose-200" : "bg-surface"}
        />
        <Card
          label="NILAI STOK"
          value={formatRupiah(totalNilai)}
          bg="bg-emerald-50 border-emerald-200"
          small
        />
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => setCreating(true)}
          className="px-4 py-2 bg-brand-600 text-white rounded-md text-sm font-bold inline-flex items-center gap-1.5"
        >
          <Plus size={14} /> Tambah Bahan Baku
        </button>
      </div>

      {(creating || editing) && (
        <BahanForm
          initial={editing ?? undefined}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}

      {mutasiFor && (
        <MutasiForm
          item={mutasiFor.item}
          arah={mutasiFor.arah}
          onClose={() => setMutasiFor(null)}
        />
      )}

      <div className="bg-surface border border-line rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-line">
          <h2 className="font-bold text-sm">Daftar Bahan Baku</h2>
        </div>
        {items.length === 0 ? (
          <div className="p-8 text-center text-sm text-[color:var(--muted)]">
            Belum ada bahan baku. Tambah dulu.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[color:var(--surface2)] text-[color:var(--muted)] text-left text-xs">
                <tr>
                  <th className="p-3">Nama</th>
                  <th className="p-3 text-right">Stok</th>
                  <th className="p-3 hidden sm:table-cell text-right">Threshold</th>
                  <th className="p-3 hidden md:table-cell text-right">Harga/Satuan</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {items.map((b) => {
                  const low = b.aktif && b.threshold > 0 && b.stok <= b.threshold;
                  return (
                    <tr
                      key={b.id}
                      className={b.aktif ? "" : "opacity-50"}
                    >
                      <td className="p-3">
                        <div className="font-bold inline-flex items-center gap-1.5">
                          {b.nama}
                          {low && (
                            <AlertTriangle
                              size={13}
                              className="text-rose-600"
                              aria-label="Stok menipis"
                            />
                          )}
                        </div>
                        {b.catatan && (
                          <div className="text-[11px] text-[color:var(--muted)] mt-0.5 italic">
                            {b.catatan}
                          </div>
                        )}
                        {!b.aktif && (
                          <div className="text-[11px] text-[color:var(--muted)] mt-0.5">
                            NONAKTIF
                          </div>
                        )}
                      </td>
                      <td
                        className={`p-3 text-right font-mono font-bold whitespace-nowrap ${
                          low ? "text-rose-700" : "text-ink"
                        }`}
                      >
                        {b.stok} {b.satuan}
                      </td>
                      <td className="p-3 text-right hidden sm:table-cell text-xs">
                        {b.threshold > 0 ? `${b.threshold} ${b.satuan}` : "—"}
                      </td>
                      <td className="p-3 text-right hidden md:table-cell text-xs font-mono">
                        {b.hargaSatuan > 0 ? formatRupiah(b.hargaSatuan) : "—"}
                      </td>
                      <td className="p-3 text-right whitespace-nowrap">
                        <button
                          onClick={() => setMutasiFor({ item: b, arah: "in" })}
                          disabled={!b.aktif}
                          className="text-emerald-600 hover:opacity-70 inline-block mr-1.5 disabled:opacity-30"
                          title="Masuk (beli/tambah)"
                        >
                          <ArrowDownToLine size={14} />
                        </button>
                        <button
                          onClick={() => setMutasiFor({ item: b, arah: "out" })}
                          disabled={!b.aktif || b.stok === 0}
                          className="text-amber-600 hover:opacity-70 inline-block mr-1.5 disabled:opacity-30"
                          title="Keluar (pakai/rusak)"
                        >
                          <ArrowUpFromLine size={14} />
                        </button>
                        <button
                          onClick={() => setEditing(b)}
                          className="text-brand hover:opacity-70 inline-block mr-1.5"
                          title="Edit"
                        >
                          <Pencil size={14} />
                        </button>
                        <ToggleButton id={b.id} aktif={b.aktif} />
                        <DeleteButton id={b.id} nama={b.nama} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {recentMutasi.length > 0 && (
        <div className="bg-surface border border-line rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-line flex items-center gap-2">
            <History size={14} className="text-[color:var(--muted)]" />
            <h2 className="font-bold text-sm">Riwayat Mutasi (50 Terbaru)</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[color:var(--surface2)] text-[color:var(--muted)] text-left text-xs">
                <tr>
                  <th className="p-3">Tanggal</th>
                  <th className="p-3">Bahan</th>
                  <th className="p-3 text-right">Perubahan</th>
                  <th className="p-3 hidden sm:table-cell">Alasan</th>
                  <th className="p-3 hidden md:table-cell">Petugas</th>
                  <th className="p-3 text-right">Biaya</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {recentMutasi.map((m) => (
                  <tr key={m.id}>
                    <td className="p-3 text-xs whitespace-nowrap">
                      {fmt(m.createdAt, { dateStyle: "short", timeStyle: "short" })}
                    </td>
                    <td className="p-3 text-xs">{m.bahanNama}</td>
                    <td
                      className={`p-3 text-right font-mono text-xs font-bold whitespace-nowrap ${
                        m.perubahan > 0 ? "text-emerald-700" : "text-amber-700"
                      }`}
                    >
                      {m.perubahan > 0 ? "+" : ""}
                      {m.perubahan} {m.satuan}
                    </td>
                    <td className="p-3 text-xs hidden sm:table-cell">{m.alasan}</td>
                    <td className="p-3 text-xs hidden md:table-cell">
                      {m.userName ?? "—"}
                    </td>
                    <td className="p-3 text-right font-mono text-xs">
                      {m.biaya > 0 ? formatRupiah(m.biaya) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Card({
  label,
  value,
  bg,
  small,
}: {
  label: string;
  value: string;
  bg: string;
  small?: boolean;
}) {
  return (
    <div className={`border rounded-2xl p-4 ${bg}`}>
      <div className="text-[10px] font-bold tracking-widest text-[color:var(--muted)]">
        {label}
      </div>
      <div className={`font-extrabold mt-1 ${small ? "text-lg" : "text-2xl"}`}>{value}</div>
    </div>
  );
}

function ToggleButton({ id, aktif }: { id: number; aktif: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      onClick={() => startTransition(async () => void (await toggleBahanAktif(id, !aktif)))}
      disabled={pending}
      className="text-[color:var(--muted)] hover:opacity-70 inline-block mr-1.5 disabled:opacity-30"
      title={aktif ? "Nonaktifkan" : "Aktifkan"}
    >
      {aktif ? <Power size={14} /> : <PowerOff size={14} />}
    </button>
  );
}

function DeleteButton({ id, nama }: { id: number; nama: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => {
        if (
          confirm(
            `Hapus "${nama}"? Riwayat mutasi juga akan terhapus. Lebih aman nonaktifkan saja.`,
          )
        ) {
          startTransition(async () => void (await deleteBahanBaku(id)));
        }
      }}
      className="text-red-500 hover:opacity-70 disabled:opacity-30"
      title="Hapus"
    >
      <Trash2 size={14} />
    </button>
  );
}

function BahanForm({
  initial,
  onClose,
}: {
  initial?: BahanItem;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [nama, setNama] = useState(initial?.nama ?? "");
  const [satuan, setSatuan] = useState(initial?.satuan ?? "pcs");
  const [threshold, setThreshold] = useState(String(initial?.threshold ?? 0));
  const [hargaSatuan, setHargaSatuan] = useState(String(initial?.hargaSatuan ?? 0));
  const [catatan, setCatatan] = useState(initial?.catatan ?? "");

  function submit() {
    setError(null);
    startTransition(async () => {
      const r = await saveBahanBaku({
        id: initial?.id,
        nama,
        satuan,
        threshold: parseInt(threshold, 10) || 0,
        hargaSatuan: parseInt(hargaSatuan, 10) || 0,
        catatan,
      });
      if ("error" in r) setError(r.error);
      else onClose();
    });
  }

  return (
    <div className="bg-surface border border-line rounded-2xl p-4 space-y-3">
      <div className="flex justify-between items-center">
        <h2 className="font-bold">{initial ? "Edit Bahan Baku" : "Tambah Bahan Baku"}</h2>
        <button onClick={onClose} className="text-[color:var(--muted)]">
          <X size={18} />
        </button>
      </div>
      <div>
        <label className="text-xs font-medium block mb-1">Nama</label>
        <input
          value={nama}
          onChange={(e) => setNama(e.target.value)}
          placeholder="mis: Tutup Galon Biru, Segel Polos, Label Logo"
          className="w-full px-3 py-2 border border-line rounded-md text-sm"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="text-xs font-medium block mb-1">Satuan</label>
          <input
            value={satuan}
            onChange={(e) => setSatuan(e.target.value)}
            placeholder="pcs, kg, liter"
            className="w-full px-3 py-2 border border-line rounded-md text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">Threshold (alert)</label>
          <input
            type="number"
            min={0}
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            className="w-full px-3 py-2 border border-line rounded-md text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">Harga/Satuan (Rp)</label>
          <input
            type="number"
            min={0}
            value={hargaSatuan}
            onChange={(e) => setHargaSatuan(e.target.value)}
            className="w-full px-3 py-2 border border-line rounded-md text-sm font-mono"
          />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium block mb-1">Catatan (opsional)</label>
        <textarea
          value={catatan}
          onChange={(e) => setCatatan(e.target.value)}
          rows={2}
          placeholder="Brand, supplier, dll"
          className="w-full px-3 py-2 border border-line rounded-md text-sm"
        />
      </div>
      {error && <div className="text-xs text-red-600">{error}</div>}
      <div className="flex justify-end gap-2 pt-2 border-t border-line">
        <button onClick={onClose} className="px-4 py-2 border border-line rounded-md text-sm">
          Batal
        </button>
        <button
          onClick={submit}
          disabled={pending || !nama.trim()}
          className="px-4 py-2 bg-brand-600 text-white rounded-md text-sm font-bold inline-flex items-center gap-1.5 disabled:opacity-50"
        >
          {pending && <Loader2 size={14} className="animate-spin" />}
          {pending ? "Menyimpan..." : "Simpan"}
        </button>
      </div>
    </div>
  );
}

function MutasiForm({
  item,
  arah,
  onClose,
}: {
  item: BahanItem;
  arah: "in" | "out";
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [jumlah, setJumlah] = useState("");
  const [alasan, setAlasan] = useState(arah === "in" ? "Beli stok" : "Pakai produksi");
  const [biaya, setBiaya] = useState("");
  const [catatan, setCatatan] = useState("");
  const [trackPengeluaran, setTrackPengeluaran] = useState(arah === "in");

  const isMasuk = arah === "in";
  const labelArah = isMasuk ? "MASUK" : "KELUAR";
  const colorClass = isMasuk
    ? "bg-emerald-50 border-emerald-200"
    : "bg-amber-50 border-amber-200";

  function submit() {
    setError(null);
    const n = parseInt(jumlah.replace(/[^0-9]/g, ""), 10);
    if (!Number.isFinite(n) || n <= 0) {
      setError("Jumlah harus positif");
      return;
    }
    const perubahan = isMasuk ? n : -n;
    const biayaN = biaya ? parseInt(biaya.replace(/[^0-9]/g, ""), 10) : 0;
    startTransition(async () => {
      const r = await catatMutasi({
        bahanId: item.id,
        perubahan,
        alasan,
        biaya: biayaN,
        catatan,
        trackKePengeluaran: trackPengeluaran,
      });
      if ("error" in r) setError(r.error);
      else {
        onClose();
        router.refresh();
      }
    });
  }

  return (
    <div className={`border rounded-2xl p-4 space-y-3 ${colorClass}`}>
      <div className="flex justify-between items-center">
        <h2 className="font-bold">
          {labelArah}: {item.nama}{" "}
          <span className="text-xs text-[color:var(--muted)]">
            (stok: {item.stok} {item.satuan})
          </span>
        </h2>
        <button onClick={onClose} className="text-[color:var(--muted)]">
          <X size={18} />
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium block mb-1">
            Jumlah ({item.satuan})
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={jumlah}
            onChange={(e) => setJumlah(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="0"
            className="w-full px-3 py-2 border border-line rounded-md text-sm font-mono"
          />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">Alasan</label>
          <input
            value={alasan}
            onChange={(e) => setAlasan(e.target.value)}
            placeholder={isMasuk ? "Beli stok" : "Pakai produksi"}
            className="w-full px-3 py-2 border border-line rounded-md text-sm"
          />
        </div>
      </div>
      {isMasuk && (
        <div>
          <label className="text-xs font-medium block mb-1">Biaya Total (Rp, opsional)</label>
          <input
            type="text"
            inputMode="numeric"
            value={biaya}
            onChange={(e) => setBiaya(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="500000"
            className="w-full px-3 py-2 border border-line rounded-md text-sm font-mono"
          />
        </div>
      )}
      <div>
        <label className="text-xs font-medium block mb-1">Catatan (opsional)</label>
        <textarea
          value={catatan}
          onChange={(e) => setCatatan(e.target.value)}
          rows={2}
          placeholder="mis: dari supplier ABC, dipakai untuk batch X"
          className="w-full px-3 py-2 border border-line rounded-md text-sm"
        />
      </div>
      {isMasuk && biaya && parseInt(biaya, 10) > 0 && (
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={trackPengeluaran}
            onChange={(e) => setTrackPengeluaran(e.target.checked)}
          />
          Catat juga sebagai pengeluaran
        </label>
      )}
      {error && <div className="text-xs text-red-600">{error}</div>}
      <div className="flex justify-end gap-2 pt-2 border-t border-line">
        <button onClick={onClose} className="px-4 py-2 border border-line rounded-md text-sm">
          Batal
        </button>
        <button
          onClick={submit}
          disabled={pending || !jumlah}
          className={`px-4 py-2 text-white rounded-md text-sm font-bold inline-flex items-center gap-1.5 disabled:opacity-50 ${
            isMasuk ? "bg-emerald-600" : "bg-amber-600"
          }`}
        >
          {pending && <Loader2 size={14} className="animate-spin" />}
          Catat {labelArah}
        </button>
      </div>
    </div>
  );
}
