"use client";

import { useState, useTransition } from "react";
import { Plus, Edit3, X, Loader2, Package, Truck, Wrench, Check, EyeOff, Eye, Trash2 } from "lucide-react";
import { formatRupiah } from "@/lib/utils";
import { RupiahInput } from "@/components/RupiahInput";
import {
  tambahKategoriBiayaAction,
  updateKategoriBiayaAction,
  toggleAktifKategoriBiayaAction,
  hapusKategoriBiayaAction,
} from "./actions";

type Tipe = "cogs" | "operasional" | "sparepart";

type Kategori = {
  id: number;
  slug: string;
  nama: string;
  tipe: Tipe;
  umurHariDefault: number | null;
  hargaEstimasi: number | null;
  urutan: number;
  aktif: boolean;
  isSystem: boolean;
};

const TIPE_TABS: { key: Tipe; label: string; icon: React.ReactNode; color: string }[] = [
  { key: "cogs", label: "COGS", icon: <Package size={14} />, color: "sky" },
  { key: "operasional", label: "Operasional", icon: <Truck size={14} />, color: "amber" },
  { key: "sparepart", label: "Sparepart", icon: <Wrench size={14} />, color: "violet" },
];

export function KategoriBiayaClient({ rows }: { rows: Kategori[] }) {
  const [tab, setTab] = useState<Tipe>("cogs");
  const [tambahOpen, setTambahOpen] = useState(false);
  const [editRow, setEditRow] = useState<Kategori | null>(null);

  const filtered = rows.filter((r) => r.tipe === tab);
  const counts = {
    cogs: rows.filter((r) => r.tipe === "cogs" && r.aktif).length,
    operasional: rows.filter((r) => r.tipe === "operasional" && r.aktif).length,
    sparepart: rows.filter((r) => r.tipe === "sparepart" && r.aktif).length,
  };

  return (
    <>
      {/* Tabs */}
      <div className="flex gap-1 border-b border-line overflow-x-auto">
        {TIPE_TABS.map((t) => {
          const isActive = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm font-bold inline-flex items-center gap-1.5 border-b-2 transition ${
                isActive
                  ? "border-brand text-brand"
                  : "border-transparent text-[color:var(--muted)] hover:text-ink"
              }`}
            >
              {t.icon} {t.label}
              <span className="text-[10px] bg-[color:var(--surface2)] px-1.5 py-0.5 rounded-full">
                {counts[t.key]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Header: tambah */}
      <div className="flex justify-end">
        <button
          onClick={() => setTambahOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700"
        >
          <Plus size={14} /> Tambah Kategori
        </button>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-surface border border-line rounded-2xl p-8 text-center text-sm text-[color:var(--muted)]">
          Belum ada kategori tipe {tab}.
        </div>
      ) : (
        <div className="bg-surface border border-line rounded-2xl overflow-hidden">
          <div className="divide-y divide-line">
            {filtered.map((r) => (
              <KategoriRow key={r.id} row={r} onEdit={() => setEditRow(r)} />
            ))}
          </div>
        </div>
      )}

      {tambahOpen && (
        <TambahModal defaultTipe={tab} onClose={() => setTambahOpen(false)} />
      )}
      {editRow && <EditModal row={editRow} onClose={() => setEditRow(null)} />}
    </>
  );
}

function KategoriRow({ row, onEdit }: { row: Kategori; onEdit: () => void }) {
  const [pending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(async () => {
      await toggleAktifKategoriBiayaAction(row.id);
      window.location.reload();
    });
  }

  function handleHapus() {
    if (row.isSystem) {
      alert("Kategori system tidak bisa dihapus. Nonaktifkan saja kalau tidak dipakai.");
      return;
    }
    if (!confirm(`Hapus kategori "${row.nama}"?\n\nPastikan tidak ada pengeluaran/pemeliharaan yang pakai kategori ini.`)) return;
    startTransition(async () => {
      const res = await hapusKategoriBiayaAction(row.id);
      if ("error" in res) {
        alert(`Gagal: ${res.error}`);
        return;
      }
      window.location.reload();
    });
  }

  return (
    <div
      className={`px-4 py-3 flex items-center gap-3 ${
        row.aktif ? "" : "opacity-50 bg-[color:var(--surface2)]"
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-sm">{row.nama}</span>
          {row.isSystem && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-bold">
              SYSTEM
            </span>
          )}
          {!row.aktif && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-bold">
              NONAKTIF
            </span>
          )}
        </div>
        <div className="text-[11px] text-[color:var(--muted)] mt-0.5 font-mono">
          {row.slug}
        </div>
        {row.tipe === "sparepart" && (
          <div className="text-[11px] text-violet-700 mt-1 flex gap-3 flex-wrap">
            <span>
              Umur: <b>{row.umurHariDefault ?? "—"} hari</b>
              {row.umurHariDefault && (
                <span className="text-[color:var(--muted)]">
                  {" "}
                  (~{Math.round(row.umurHariDefault / 30)} bulan)
                </span>
              )}
            </span>
            {row.hargaEstimasi !== null && (
              <span>
                Estimasi: <b>{formatRupiah(row.hargaEstimasi)}</b>
              </span>
            )}
          </div>
        )}
      </div>
      <div className="flex gap-1 shrink-0">
        <button
          onClick={onEdit}
          disabled={pending}
          className="p-1.5 text-brand hover:bg-brand-soft rounded disabled:opacity-50"
          title="Edit"
        >
          <Edit3 size={14} />
        </button>
        <button
          onClick={handleToggle}
          disabled={pending}
          className="p-1.5 text-amber-700 hover:bg-amber-50 rounded disabled:opacity-50"
          title={row.aktif ? "Nonaktifkan" : "Aktifkan"}
        >
          {row.aktif ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
        {!row.isSystem && (
          <button
            onClick={handleHapus}
            disabled={pending}
            className="p-1.5 text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
            title="Hapus"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

function TambahModal({
  defaultTipe,
  onClose,
}: {
  defaultTipe: Tipe;
  onClose: () => void;
}) {
  const [nama, setNama] = useState("");
  const [tipe, setTipe] = useState<Tipe>(defaultTipe);
  const [umur, setUmur] = useState("180");
  const [harga, setHarga] = useState("");
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const isSparepart = tipe === "sparepart";

  function submit() {
    setErr(null);
    if (nama.trim().length < 2) {
      setErr("Nama minimal 2 karakter");
      return;
    }
    startTransition(async () => {
      const res = await tambahKategoriBiayaAction({
        nama: nama.trim(),
        tipe,
        umurHariDefault: isSparepart ? parseInt(umur, 10) || 180 : null,
        hargaEstimasi: harga ? parseInt(harga, 10) : null,
      });
      if ("error" in res) {
        setErr(res.error);
        return;
      }
      window.location.reload();
    });
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 grid place-items-center p-4">
      <div className="bg-surface rounded-2xl max-w-md w-full p-5 space-y-3 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start">
          <h2 className="font-bold text-lg inline-flex items-center gap-1.5">
            <Plus size={18} /> Tambah Kategori
          </h2>
          <button onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div>
          <label className="text-xs font-bold block mb-1">Nama Kategori</label>
          <input
            type="text"
            value={nama}
            onChange={(e) => setNama(e.target.value)}
            placeholder="mis: Membran RO 100 GPD"
            className="w-full px-3 py-2 border border-line rounded-md text-sm"
            autoFocus
          />
        </div>

        <div>
          <label className="text-xs font-bold block mb-1">Tipe</label>
          <div className="grid grid-cols-3 gap-1">
            {TIPE_TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTipe(t.key)}
                className={`px-2 py-2 rounded-md text-xs font-bold inline-flex items-center justify-center gap-1 ${
                  tipe === t.key
                    ? "bg-brand text-white"
                    : "bg-[color:var(--surface2)] text-[color:var(--muted)]"
                }`}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>

        {isSparepart && (
          <>
            <div>
              <label className="text-xs font-bold block mb-1">
                Umur Estimasi (hari)
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={umur}
                onChange={(e) => setUmur(e.target.value.replace(/\D/g, ""))}
                placeholder="180"
                className="w-full px-3 py-2 border border-line rounded-md text-sm font-mono"
              />
              <div className="text-[10px] text-[color:var(--muted)] mt-1">
                Contoh: 90 (3 bulan), 180 (6 bulan), 365 (1 tahun), 1825 (5 tahun)
              </div>
            </div>

            <div>
              <label className="text-xs font-bold block mb-1">
                Harga Estimasi (opsional)
              </label>
              <RupiahInput
                value={harga}
                onChange={setHarga}
                placeholder="300000"
              />
            </div>
          </>
        )}

        {err && <div className="text-xs text-red-600 font-bold">{err}</div>}

        <div className="flex justify-end gap-2 pt-2 border-t border-line">
          <button
            onClick={onClose}
            disabled={pending}
            className="px-4 py-2 border border-line rounded-md text-sm"
          >
            Batal
          </button>
          <button
            onClick={submit}
            disabled={pending}
            className="px-4 py-2 bg-emerald-600 text-white rounded-md text-sm font-bold inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            {pending && <Loader2 size={14} className="animate-spin" />}
            <Check size={14} /> Simpan
          </button>
        </div>
      </div>
    </div>
  );
}

function EditModal({ row, onClose }: { row: Kategori; onClose: () => void }) {
  const [nama, setNama] = useState(row.nama);
  const [umur, setUmur] = useState(String(row.umurHariDefault ?? ""));
  const [harga, setHarga] = useState(String(row.hargaEstimasi ?? ""));
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const isSparepart = row.tipe === "sparepart";

  function submit() {
    setErr(null);
    if (nama.trim().length < 2) {
      setErr("Nama minimal 2 karakter");
      return;
    }
    startTransition(async () => {
      const res = await updateKategoriBiayaAction({
        id: row.id,
        nama: nama.trim(),
        umurHariDefault: isSparepart ? parseInt(umur, 10) || 180 : null,
        hargaEstimasi: harga ? parseInt(harga, 10) : null,
      });
      if ("error" in res) {
        setErr(res.error);
        return;
      }
      window.location.reload();
    });
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 grid place-items-center p-4">
      <div className="bg-surface rounded-2xl max-w-md w-full p-5 space-y-3 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start">
          <h2 className="font-bold text-lg inline-flex items-center gap-1.5">
            <Edit3 size={18} /> Edit Kategori
          </h2>
          <button onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="text-xs text-[color:var(--muted)] bg-[color:var(--surface2)] rounded p-2">
          Slug: <code className="font-mono">{row.slug}</code> (tidak bisa diubah)
        </div>

        <div>
          <label className="text-xs font-bold block mb-1">Nama Kategori</label>
          <input
            type="text"
            value={nama}
            onChange={(e) => setNama(e.target.value)}
            className="w-full px-3 py-2 border border-line rounded-md text-sm"
            autoFocus
          />
        </div>

        {isSparepart && (
          <>
            <div>
              <label className="text-xs font-bold block mb-1">
                Umur Estimasi (hari)
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={umur}
                onChange={(e) => setUmur(e.target.value.replace(/\D/g, ""))}
                className="w-full px-3 py-2 border border-line rounded-md text-sm font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-bold block mb-1">
                Harga Estimasi
              </label>
              <RupiahInput value={harga} onChange={setHarga} />
            </div>
          </>
        )}

        {err && <div className="text-xs text-red-600 font-bold">{err}</div>}

        <div className="flex justify-end gap-2 pt-2 border-t border-line">
          <button
            onClick={onClose}
            disabled={pending}
            className="px-4 py-2 border border-line rounded-md text-sm"
          >
            Batal
          </button>
          <button
            onClick={submit}
            disabled={pending}
            className="px-4 py-2 bg-emerald-600 text-white rounded-md text-sm font-bold inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            {pending && <Loader2 size={14} className="animate-spin" />}
            <Check size={14} /> Simpan
          </button>
        </div>
      </div>
    </div>
  );
}
