"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Loader2,
  CalendarCheck,
  Power,
  PowerOff,
  History,
} from "lucide-react";
import {
  saveFilter,
  deleteFilter,
  toggleFilterAktif,
  catatGantiFilter,
} from "./actions";
import { formatRupiah } from "@/lib/utils";
import { useFormatTanggal } from "@/components/TimezoneContext";
import {
  STATUS_COLOR,
  type FilterStatus,
} from "@/lib/filter-status";

type Kategori = "carbon" | "sediment" | "membran_ro" | "uv_lamp" | "lainnya";

export type Row = {
  id: number;
  nama: string;
  kategori: string;
  intervalHari: number;
  gantiTerakhir: string | null;
  catatan: string | null;
  aktif: boolean;
  status: FilterStatus;
  daysLeft: number | null;
  nextDueAt: string | null;
  kategoriBiayaId: number | null;
  hargaBeli: number | null;
  tanggalPasang: string | null;
};

export type SparepartMaster = {
  id: number;
  nama: string;
  umurHariDefault: number | null;
  hargaEstimasi: number | null;
};

export type LogRow = {
  id: number;
  filterId: number;
  filterNama: string;
  gantiAt: string;
  biaya: number;
  catatan: string | null;
  gantiByName: string | null;
};

type KategoriOption = { value: string; label: string; defaultInterval: number };

export function PemeliharaanClient({
  rows,
  kategoriOptions,
  sparepartMaster,
  recentLogs,
}: {
  rows: Row[];
  kategoriOptions: KategoriOption[];
  sparepartMaster: SparepartMaster[];
  recentLogs: LogRow[];
}) {
  const fmt = useFormatTanggal();
  const [editing, setEditing] = useState<Row | null>(null);
  const [creating, setCreating] = useState(false);
  const [catatFor, setCatatFor] = useState<Row | null>(null);

  const aktifCount = rows.filter((r) => r.aktif).length;
  const overdueCount = rows.filter((r) => r.aktif && r.status === "overdue").length;
  const dueSoonCount = rows.filter((r) => r.aktif && r.status === "due_soon").length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SummaryCard label="FILTER AKTIF" value={aktifCount} color="bg-surface" />
        <SummaryCard
          label="MENDEKATI JADWAL"
          value={dueSoonCount}
          color={dueSoonCount > 0 ? "bg-amber-50 border-amber-200" : "bg-surface"}
        />
        <SummaryCard
          label="LEWAT JADWAL"
          value={overdueCount}
          color={overdueCount > 0 ? "bg-rose-50 border-rose-200" : "bg-surface"}
        />
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => setCreating(true)}
          className="px-4 py-2 bg-brand-600 text-white rounded-md text-sm font-bold inline-flex items-center gap-1.5"
        >
          <Plus size={14} /> Tambah Filter
        </button>
      </div>

      {(creating || editing) && (
        <FilterForm
          initial={editing ?? undefined}
          kategoriOptions={kategoriOptions}
          sparepartMaster={sparepartMaster}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}

      {catatFor && (
        <CatatGantiForm
          row={catatFor}
          onClose={() => setCatatFor(null)}
        />
      )}

      <div className="bg-surface border border-line rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-line">
          <h2 className="font-bold text-sm">Daftar Filter</h2>
        </div>
        {rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-[color:var(--muted)]">
            Belum ada filter. Klik "Tambah Filter" untuk mulai.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[color:var(--surface2)] text-[color:var(--muted)] text-left text-xs">
                <tr>
                  <th className="p-3">Filter</th>
                  <th className="p-3 hidden sm:table-cell">Interval</th>
                  <th className="p-3">Ganti Terakhir</th>
                  <th className="p-3">Status</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => {
                  const s = STATUS_COLOR[r.status];
                  return (
                    <tr
                      key={r.id}
                      className={r.aktif ? "" : "opacity-50"}
                    >
                      <td className="p-3">
                        <div className="font-bold capitalize">{r.nama}</div>
                        <div className="text-[11px] text-[color:var(--muted)] capitalize">
                          {r.kategori.replace(/_/g, " ")}
                          {!r.aktif && " · NONAKTIF"}
                        </div>
                        {r.catatan && (
                          <div className="text-[11px] text-[color:var(--muted)] mt-0.5 italic">
                            {r.catatan}
                          </div>
                        )}
                      </td>
                      <td className="p-3 hidden sm:table-cell text-xs">
                        {r.intervalHari} hari
                      </td>
                      <td className="p-3 text-xs">
                        {r.gantiTerakhir ? (
                          <>
                            {fmt(r.gantiTerakhir, { dateStyle: "medium" })}
                            {r.nextDueAt && (
                              <div className="text-[11px] text-[color:var(--muted)]">
                                Next: {fmt(r.nextDueAt, { dateStyle: "medium" })}
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="text-[color:var(--muted)]">—</span>
                        )}
                      </td>
                      <td className="p-3">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${s.bg} ${s.fg}`}
                        >
                          {s.label}
                        </span>
                        {r.daysLeft !== null && (
                          <div className="text-[11px] text-[color:var(--muted)] mt-0.5">
                            {r.daysLeft >= 0 ? `${r.daysLeft} hari lagi` : `Lewat ${Math.abs(r.daysLeft)} hari`}
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-right whitespace-nowrap">
                        <button
                          onClick={() => setCatatFor(r)}
                          disabled={!r.aktif}
                          className="text-emerald-600 hover:opacity-70 inline-block mr-2 disabled:opacity-30"
                          title="Catat penggantian"
                        >
                          <CalendarCheck size={14} />
                        </button>
                        <button
                          onClick={() => setEditing(r)}
                          className="text-brand hover:opacity-70 inline-block mr-2"
                          title="Edit"
                        >
                          <Pencil size={14} />
                        </button>
                        <ToggleAktifButton id={r.id} aktif={r.aktif} />
                        <DeleteButton id={r.id} nama={r.nama} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {recentLogs.length > 0 && (
        <div className="bg-surface border border-line rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-line flex items-center gap-2">
            <History size={14} className="text-[color:var(--muted)]" />
            <h2 className="font-bold text-sm">Riwayat Penggantian (30 Terbaru)</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-[color:var(--surface2)] text-[color:var(--muted)] text-left text-xs">
              <tr>
                <th className="p-3">Tanggal</th>
                <th className="p-3">Filter</th>
                <th className="p-3 hidden sm:table-cell">Petugas</th>
                <th className="p-3 hidden md:table-cell">Catatan</th>
                <th className="p-3 text-right">Biaya</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {recentLogs.map((l) => (
                <tr key={l.id}>
                  <td className="p-3 text-xs whitespace-nowrap">
                    {fmt(l.gantiAt, { dateStyle: "medium" })}
                  </td>
                  <td className="p-3 text-xs">{l.filterNama}</td>
                  <td className="p-3 text-xs hidden sm:table-cell">
                    {l.gantiByName ?? "—"}
                  </td>
                  <td className="p-3 text-xs text-[color:var(--muted)] hidden md:table-cell max-w-xs truncate">
                    {l.catatan ?? "—"}
                  </td>
                  <td className="p-3 text-right font-mono text-xs">
                    {l.biaya > 0 ? formatRupiah(l.biaya) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className={`border rounded-2xl p-4 ${color}`}>
      <div className="text-[10px] font-bold tracking-widest text-[color:var(--muted)]">
        {label}
      </div>
      <div className="text-2xl font-extrabold mt-1">{value}</div>
    </div>
  );
}

function ToggleAktifButton({ id, aktif }: { id: number; aktif: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      onClick={() => startTransition(async () => void (await toggleFilterAktif(id, !aktif)))}
      disabled={pending}
      className="text-[color:var(--muted)] hover:opacity-70 inline-block mr-2 disabled:opacity-30"
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
            `Hapus "${nama}"? History penggantian juga akan terhapus. Pertimbangkan nonaktifkan saja.`,
          )
        ) {
          startTransition(async () => void (await deleteFilter(id)));
        }
      }}
      className="text-red-500 hover:opacity-70 disabled:opacity-30"
      title="Hapus"
    >
      <Trash2 size={14} />
    </button>
  );
}

function FilterForm({
  initial,
  kategoriOptions,
  sparepartMaster,
  onClose,
}: {
  initial?: Row;
  kategoriOptions: KategoriOption[];
  sparepartMaster: SparepartMaster[];
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [nama, setNama] = useState(initial?.nama ?? "");
  const [kategori, setKategori] = useState<Kategori>(
    (initial?.kategori as Kategori) ?? "carbon",
  );
  const [intervalHari, setIntervalHari] = useState(
    String(initial?.intervalHari ?? 180),
  );
  const [catatan, setCatatan] = useState(initial?.catatan ?? "");
  // Amortisasi fields (Fase 2)
  const [kategoriBiayaId, setKategoriBiayaId] = useState<string>(
    initial?.kategoriBiayaId ? String(initial.kategoriBiayaId) : "",
  );
  const [hargaBeli, setHargaBeli] = useState(
    initial?.hargaBeli ? String(initial.hargaBeli) : "",
  );
  const [tanggalPasang, setTanggalPasang] = useState(
    initial?.tanggalPasang
      ? initial.tanggalPasang.slice(0, 10)
      : initial
        ? ""
        : new Date().toISOString().slice(0, 10),
  );

  function handleKategoriChange(k: string) {
    setKategori(k as Kategori);
    if (!initial) {
      const opt = kategoriOptions.find((o) => o.value === k);
      if (opt) setIntervalHari(String(opt.defaultInterval));
    }
  }

  function handleMasterChange(id: string) {
    setKategoriBiayaId(id);
    // Auto-fill umur & harga default kalau pilih master
    if (!id) return;
    const master = sparepartMaster.find((m) => m.id === Number(id));
    if (master) {
      if (master.umurHariDefault) setIntervalHari(String(master.umurHariDefault));
      if (master.hargaEstimasi && !hargaBeli)
        setHargaBeli(String(master.hargaEstimasi));
      // Auto-fill nama kalau kosong
      if (!nama.trim()) setNama(master.nama);
    }
  }

  function submit() {
    setError(null);
    const n = parseInt(intervalHari, 10);
    const hb = hargaBeli ? parseInt(hargaBeli.replace(/\D/g, ""), 10) : null;
    startTransition(async () => {
      const r = await saveFilter({
        id: initial?.id,
        nama,
        kategori,
        intervalHari: n,
        catatan,
        kategoriBiayaId: kategoriBiayaId ? Number(kategoriBiayaId) : null,
        hargaBeli: hb,
        tanggalPasang: tanggalPasang || null,
      });
      if ("error" in r) setError(r.error);
      else onClose();
    });
  }

  return (
    <div className="bg-surface border border-line rounded-2xl p-4 space-y-3">
      <div className="flex justify-between items-center">
        <h2 className="font-bold">{initial ? "Edit Filter" : "Tambah Filter"}</h2>
        <button onClick={onClose} className="text-[color:var(--muted)]">
          <X size={18} />
        </button>
      </div>

      <div>
        <label className="text-xs font-medium block mb-1">Nama Filter</label>
        <input
          value={nama}
          onChange={(e) => setNama(e.target.value)}
          placeholder="mis: Carbon Filter Lt 1"
          className="w-full px-3 py-2 border border-line rounded-md text-sm"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium block mb-1">Kategori</label>
          <select
            value={kategori}
            onChange={(e) => handleKategoriChange(e.target.value)}
            className="w-full px-3 py-2 border border-line rounded-md text-sm bg-surface"
          >
            {kategoriOptions.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">Interval Ganti (hari)</label>
          <input
            type="number"
            min={1}
            value={intervalHari}
            onChange={(e) => setIntervalHari(e.target.value)}
            className="w-full px-3 py-2 border border-line rounded-md text-sm"
          />
        </div>
      </div>

      {/* Amortisasi (link ke master kategori sparepart) */}
      <div className="bg-violet-50 border border-violet-200 rounded-lg p-3 space-y-2">
        <div className="text-xs font-bold text-violet-900">
          🔗 Link ke Master Sparepart (opsional — untuk analisis laba)
        </div>
        <div className="text-[10px] text-violet-800 leading-relaxed">
          Kalau di-link, biaya akan otomatis di-amortisasi (tersebar rata sesuai
          umur pakai) di Laporan Laba.
        </div>

        <div>
          <label className="text-xs font-medium block mb-1">
            Master Sparepart
          </label>
          <select
            value={kategoriBiayaId}
            onChange={(e) => handleMasterChange(e.target.value)}
            className="w-full px-3 py-2 border border-line rounded-md text-sm bg-surface"
          >
            <option value="">— Tidak di-link (tidak diamortisasi) —</option>
            {sparepartMaster.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nama}
                {m.umurHariDefault && ` (~${Math.round(m.umurHariDefault / 30)} bln)`}
              </option>
            ))}
          </select>
        </div>

        {kategoriBiayaId && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium block mb-1">
                Harga Beli (Rp)
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={hargaBeli}
                onChange={(e) => setHargaBeli(e.target.value.replace(/\D/g, ""))}
                placeholder="300000"
                className="w-full px-3 py-2 border border-line rounded-md text-sm font-mono"
              />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">
                Tanggal Pasang
              </label>
              <input
                type="date"
                value={tanggalPasang}
                onChange={(e) => setTanggalPasang(e.target.value)}
                className="w-full px-3 py-2 border border-line rounded-md text-sm"
              />
            </div>
          </div>
        )}
      </div>

      <div>
        <label className="text-xs font-medium block mb-1">Catatan (opsional)</label>
        <textarea
          value={catatan}
          onChange={(e) => setCatatan(e.target.value)}
          rows={2}
          placeholder="Brand, supplier, atau catatan lain"
          className="w-full px-3 py-2 border border-line rounded-md text-sm"
        />
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

function CatatGantiForm({ row, onClose }: { row: Row; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [tanggal, setTanggal] = useState(new Date().toISOString().slice(0, 10));
  const [biaya, setBiaya] = useState(row.hargaBeli ? String(row.hargaBeli) : "");
  const [catatan, setCatatan] = useState("");
  const [alasanGanti, setAlasanGanti] = useState("");
  const [trackPengeluaran, setTrackPengeluaran] = useState(true);

  // Hitung umur pakai sekarang (untuk deteksi cepat kalau ganti prematur)
  const umurPakaiHari = row.tanggalPasang
    ? Math.round(
        (new Date(tanggal).getTime() - new Date(row.tanggalPasang).getTime()) /
          (24 * 60 * 60 * 1000),
      )
    : row.gantiTerakhir
      ? Math.round(
          (new Date(tanggal).getTime() -
            new Date(row.gantiTerakhir).getTime()) /
            (24 * 60 * 60 * 1000),
        )
      : null;

  const prematur = umurPakaiHari !== null && umurPakaiHari < row.intervalHari * 0.75;

  function submit() {
    setError(null);
    const n = biaya ? parseInt(biaya.replace(/[^0-9]/g, ""), 10) : 0;
    if (prematur && alasanGanti.trim().length < 3) {
      setError(
        `Umur cuma ${umurPakaiHari} hari (target ${row.intervalHari} hari) — alasan wajib supaya bisa track kualitas air.`,
      );
      return;
    }
    startTransition(async () => {
      const r = await catatGantiFilter({
        filterId: row.id,
        gantiAt: tanggal,
        biaya: n,
        catatan,
        alasanGanti: alasanGanti.trim() || undefined,
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
    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-3">
      <div className="flex justify-between items-center">
        <h2 className="font-bold text-emerald-900">
          Catat Penggantian: {row.nama}
        </h2>
        <button onClick={onClose} className="text-emerald-900">
          <X size={18} />
        </button>
      </div>

      {/* Info umur pakai */}
      {umurPakaiHari !== null && (
        <div
          className={`rounded-lg p-2.5 text-xs ${
            prematur
              ? "bg-amber-100 border border-amber-300 text-amber-900"
              : "bg-white border border-emerald-200"
          }`}
        >
          <div className="font-bold">
            {prematur ? "⚠ " : "✓ "}Umur pakai: <b>{umurPakaiHari} hari</b>{" "}
            <span className="text-[color:var(--muted)] font-normal">
              (target {row.intervalHari} hari ={" "}
              {Math.round((umurPakaiHari / row.intervalHari) * 100)}%)
            </span>
          </div>
          {prematur && (
            <div className="mt-1 text-[11px]">
              Umur pendek — kemungkinan indikator: kualitas air baku turun,
              pemakaian tinggi, atau pre-filter perlu dicek.
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium block mb-1">Tanggal Ganti</label>
          <input
            type="date"
            value={tanggal}
            onChange={(e) => setTanggal(e.target.value)}
            className="w-full px-3 py-2 border border-line rounded-md text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">
            Biaya {row.hargaBeli && "(update harga baru)"}
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={biaya}
            onChange={(e) => setBiaya(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="200000"
            className="w-full px-3 py-2 border border-line rounded-md text-sm font-mono"
          />
          {row.hargaBeli && (
            <div className="text-[10px] text-[color:var(--muted)] mt-0.5">
              Harga sebelumnya: {formatRupiah(row.hargaBeli)}
            </div>
          )}
        </div>
      </div>

      {prematur && (
        <div>
          <label className="text-xs font-medium block mb-1 text-amber-900">
            Alasan ganti lebih cepat <span className="text-red-600">(WAJIB)</span>
          </label>
          <input
            type="text"
            value={alasanGanti}
            onChange={(e) => setAlasanGanti(e.target.value)}
            placeholder="mis: warna air kuning, tekanan turun, cartridge pecah"
            className="w-full px-3 py-2 border border-amber-300 rounded-md text-sm"
          />
        </div>
      )}

      <div>
        <label className="text-xs font-medium block mb-1">Catatan tambahan (opsional)</label>
        <textarea
          value={catatan}
          onChange={(e) => setCatatan(e.target.value)}
          rows={2}
          placeholder="Supplier baru, brand, dll"
          className="w-full px-3 py-2 border border-line rounded-md text-sm"
        />
      </div>

      {biaya && parseInt(biaya, 10) > 0 && (
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={trackPengeluaran}
            onChange={(e) => setTrackPengeluaran(e.target.checked)}
          />
          Catat juga sebagai pengeluaran{" "}
          {row.kategoriBiayaId ? "(pakai kategori master)" : '(kategori "filter")'}
        </label>
      )}

      {error && <div className="text-xs text-red-600 font-bold">{error}</div>}

      {row.kategoriBiayaId && (
        <div className="bg-violet-50 border border-violet-200 rounded p-2 text-[11px] text-violet-900">
          ℹ Sparepart ini di-amortisasi. Tanggal pasang akan di-reset ke
          tanggal ganti — periode amortisasi baru dimulai.
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2 border-t border-emerald-200">
        <button
          onClick={onClose}
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
          {pending ? "Menyimpan..." : "Catat Ganti"}
        </button>
      </div>
    </div>
  );
}
