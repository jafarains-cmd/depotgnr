"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Plus, Pencil, Trash2, Receipt, X, Camera, Loader2, ExternalLink } from "lucide-react";
import { savePengeluaran, deletePengeluaran } from "./actions";
import { formatRupiah } from "@/lib/utils";
import { useFormatTanggal } from "@/components/TimezoneContext";
import { compressImage, arrayBufferToBase64 } from "@/lib/image-compress";
import { normalizeDriveUrl } from "@/lib/drive-url";

export type Row = {
  id: number;
  tanggal: string;
  kategori: string;
  jumlah: number;
  deskripsi: string | null;
  fotoNotaUrl: string | null;
  createdByName: string | null;
};

export function PengeluaranClient({
  rows,
  kategoriOptions,
  kategoriFilter,
  breakdown,
}: {
  rows: Row[];
  kategoriOptions: string[];
  kategoriFilter: string | null;
  breakdown: { kategori: string; total: number }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const fmt = useFormatTanggal();
  const [editing, setEditing] = useState<Row | null>(null);
  const [creating, setCreating] = useState(false);

  function handleKategoriFilter(value: string | null) {
    const sp = new URLSearchParams(params.toString());
    if (value) sp.set("kategori", value);
    else sp.delete("kategori");
    sp.delete("page");
    router.push(`${pathname}?${sp.toString()}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <select
          value={kategoriFilter ?? ""}
          onChange={(e) => handleKategoriFilter(e.target.value || null)}
          className="px-3 py-2 border border-line rounded-md text-sm bg-surface"
        >
          <option value="">Semua kategori</option>
          {kategoriOptions.map((k) => (
            <option key={k} value={k}>
              {k.replace(/-/g, " ")}
            </option>
          ))}
        </select>
        <button
          onClick={() => setCreating(true)}
          className="px-4 py-2 bg-brand-600 text-white rounded-md text-sm font-bold inline-flex items-center gap-1.5"
        >
          <Plus size={14} /> Tambah Pengeluaran
        </button>
      </div>

      {breakdown.length > 0 && (
        <div className="bg-surface border border-line rounded-2xl p-3">
          <div className="text-[10px] font-bold tracking-widest text-[color:var(--muted)] uppercase mb-2">
            Breakdown per Kategori
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-xs">
            {breakdown.map((b) => (
              <button
                key={b.kategori}
                onClick={() =>
                  handleKategoriFilter(
                    kategoriFilter === b.kategori ? null : b.kategori,
                  )
                }
                className={`flex justify-between gap-2 p-2 rounded-md border transition ${
                  kategoriFilter === b.kategori
                    ? "border-brand bg-brand-soft text-brand"
                    : "border-line hover:border-brand"
                }`}
              >
                <span className="truncate capitalize">{b.kategori.replace(/-/g, " ")}</span>
                <span className="font-mono font-bold">{formatRupiah(b.total)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {(creating || editing) && (
        <PengeluaranForm
          initial={editing ?? undefined}
          kategoriOptions={kategoriOptions}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}

      <div className="bg-surface border border-line rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[color:var(--surface2)] text-[color:var(--muted)] text-left text-xs">
            <tr>
              <th className="p-3">Tanggal</th>
              <th className="p-3">Kategori</th>
              <th className="p-3 hidden sm:table-cell">Deskripsi</th>
              <th className="p-3 text-right">Jumlah</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-[color:var(--surface2)]">
                <td className="p-3 text-xs whitespace-nowrap">
                  {fmt(r.tanggal, { day: "2-digit", month: "short", year: "2-digit" })}
                </td>
                <td className="p-3">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 capitalize">
                    {r.kategori.replace(/-/g, " ")}
                  </span>
                  {/* Mobile: show description below */}
                  <div className="sm:hidden text-[11px] text-[color:var(--muted)] mt-0.5">
                    {r.deskripsi ?? "—"}
                  </div>
                </td>
                <td className="p-3 hidden sm:table-cell text-xs text-[color:var(--muted)] max-w-xs truncate">
                  {r.deskripsi ?? "—"}
                </td>
                <td className="p-3 text-right font-mono font-bold text-rose-700 whitespace-nowrap">
                  {formatRupiah(r.jumlah)}
                </td>
                <td className="p-3 text-right whitespace-nowrap">
                  {r.fotoNotaUrl && (
                    <a
                      href={r.fotoNotaUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[color:var(--muted)] hover:text-brand inline-block mr-2"
                      title="Lihat foto nota"
                    >
                      <Receipt size={14} />
                    </a>
                  )}
                  <button
                    onClick={() => setEditing(r)}
                    className="text-brand hover:opacity-70 inline-block mr-2"
                    title="Edit"
                  >
                    <Pencil size={14} />
                  </button>
                  <DeleteButton id={r.id} kategori={r.kategori} />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="p-10 text-center">
                  <div className="text-4xl mb-2">💸</div>
                  <div className="font-bold">Belum ada pengeluaran</div>
                  <p className="text-xs text-[color:var(--muted)] mt-1 max-w-sm mx-auto">
                    Catat pengeluaran operasional (galon baru, biaya antar, dll)
                    untuk lihat profit bersih di laporan.
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}

function DeleteButton({ id, kategori }: { id: number; kategori: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => {
        if (confirm(`Hapus pengeluaran ${kategori.replace(/-/g, " ")} ini?`)) {
          startTransition(async () => {
            await deletePengeluaran(id);
          });
        }
      }}
      className="text-red-500 hover:opacity-70 disabled:opacity-30"
      title="Hapus"
    >
      <Trash2 size={14} />
    </button>
  );
}

function PengeluaranForm({
  initial,
  kategoriOptions,
  onClose,
}: {
  initial?: Row;
  kategoriOptions: string[];
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [tanggal, setTanggal] = useState(
    initial?.tanggal
      ? initial.tanggal.slice(0, 10)
      : new Date().toISOString().slice(0, 10),
  );
  const [kategori, setKategori] = useState(initial?.kategori ?? kategoriOptions[0]);
  const [jumlah, setJumlah] = useState(initial?.jumlah ? String(initial.jumlah) : "");
  const [deskripsi, setDeskripsi] = useState(initial?.deskripsi ?? "");
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(initial?.fotoNotaUrl ?? null);

  function handleFotoSelect(file: File) {
    setFotoFile(file);
    setFotoPreview(URL.createObjectURL(file));
  }

  function submit() {
    setError(null);
    const n = Number(jumlah.replace(/[^0-9]/g, ""));
    if (!Number.isFinite(n) || n <= 0) {
      setError("Jumlah harus angka positif");
      return;
    }
    startTransition(async () => {
      try {
        let fotoNotaBase64: string | undefined;
        let fotoNotaMimeType: string | undefined;
        if (fotoFile) {
          const compressed = await compressImage(fotoFile, { maxWidth: 1600, quality: 0.85 });
          const buf = await compressed.arrayBuffer();
          fotoNotaBase64 = arrayBufferToBase64(buf);
          fotoNotaMimeType = compressed.type || "image/jpeg";
        }
        const r = await savePengeluaran({
          id: initial?.id,
          tanggal,
          kategori,
          jumlah: n,
          deskripsi,
          fotoNotaBase64,
          fotoNotaMimeType,
        });
        if ("error" in r) setError(r.error);
        else onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Gagal simpan");
      }
    });
  }

  return (
    <div className="bg-surface border border-line rounded-2xl p-4 space-y-3">
      <div className="flex justify-between items-center">
        <h2 className="font-bold">{initial ? "Edit Pengeluaran" : "Tambah Pengeluaran"}</h2>
        <button onClick={onClose} className="text-[color:var(--muted)]">
          <X size={18} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium block mb-1">Tanggal</label>
          <input
            type="date"
            value={tanggal}
            onChange={(e) => setTanggal(e.target.value)}
            className="w-full px-3 py-2 border border-line rounded-md text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">Kategori</label>
          <select
            value={kategori}
            onChange={(e) => setKategori(e.target.value)}
            className="w-full px-3 py-2 border border-line rounded-md text-sm bg-surface capitalize"
          >
            {kategoriOptions.map((k) => (
              <option key={k} value={k}>
                {k.replace(/-/g, " ")}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="text-xs font-medium block mb-1">Jumlah (Rp)</label>
        <input
          type="text"
          inputMode="numeric"
          value={jumlah}
          onChange={(e) => setJumlah(e.target.value.replace(/[^0-9]/g, ""))}
          placeholder="100000"
          className="w-full px-3 py-2 border border-line rounded-md text-sm font-mono"
        />
      </div>

      <div>
        <label className="text-xs font-medium block mb-1">Deskripsi (opsional)</label>
        <textarea
          value={deskripsi}
          onChange={(e) => setDeskripsi(e.target.value)}
          rows={2}
          placeholder="Contoh: PLN tagihan bulan Mei, atau ganti filter carbon"
          className="w-full px-3 py-2 border border-line rounded-md text-sm"
        />
      </div>

      <div>
        <label className="text-xs font-medium block mb-1">Foto Nota (opsional)</label>
        <label className="block">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFotoSelect(f);
            }}
          />
          <div className="cursor-pointer aspect-video bg-[color:var(--surface2)] border-2 border-dashed border-line rounded-lg flex items-center justify-center overflow-hidden hover:border-brand-400">
            {fotoPreview ? (
              fotoPreview.startsWith("blob:") ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={fotoPreview} alt="Preview" className="w-full h-full object-contain" />
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={normalizeDriveUrl(fotoPreview)}
                  alt="Nota"
                  className="w-full h-full object-contain"
                />
              )
            ) : (
              <div className="text-center text-[color:var(--muted)] text-xs py-4">
                <Camera size={24} className="mx-auto mb-1" />
                Tap untuk upload foto nota
              </div>
            )}
          </div>
        </label>
        {fotoPreview && !fotoPreview.startsWith("blob:") && (
          <a
            href={fotoPreview}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] text-brand inline-flex items-center gap-1 mt-1"
          >
            <ExternalLink size={10} /> Buka di tab baru
          </a>
        )}
      </div>

      {error && <div className="text-xs text-red-600">{error}</div>}

      <div className="flex justify-end gap-2 pt-2 border-t border-line">
        <button
          onClick={onClose}
          className="px-4 py-2 border border-line rounded-md text-sm"
        >
          Batal
        </button>
        <button
          onClick={submit}
          disabled={pending || !jumlah}
          className="px-4 py-2 bg-brand-600 text-white rounded-md text-sm font-bold inline-flex items-center gap-1.5 disabled:opacity-50"
        >
          {pending && <Loader2 size={14} className="animate-spin" />}
          {pending ? "Menyimpan..." : "Simpan"}
        </button>
      </div>
    </div>
  );
}
