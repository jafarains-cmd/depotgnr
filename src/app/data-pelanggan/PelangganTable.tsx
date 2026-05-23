"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Pencil, Trash2, Plus, X, MapPin, Eye, Package, UserCheck, UserX } from "lucide-react";
import type { Pelanggan } from "@/db/schema/pelanggan";
import { upsertPelanggan, deletePelanggan } from "./actions";
import { LocationPicker } from "./LocationPicker";

type LinkedUser = { id: string; name: string; email: string; username: string | null };
type RowWithTitipan = Pelanggan & {
  titipanTotal?: number;
  linkedUser?: LinkedUser | null;
};

export function PelangganTable({
  rows,
  canDelete,
  q,
}: {
  rows: RowWithTitipan[];
  canDelete: boolean;
  q: string;
}) {
  const [editing, setEditing] = useState<Pelanggan | null>(null);
  const [creating, setCreating] = useState(false);
  const [, startTransition] = useTransition();

  const filtered = rows;

  return (
    <div className="space-y-4">
      <form method="GET" className="flex gap-3 items-center">
        <input
          name="q"
          defaultValue={q}
          placeholder="Cari nama, telp, alamat..."
          className="flex-1 px-3 py-2 border border-line rounded-md text-sm"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-brand-600 text-white rounded-md text-sm font-bold"
        >
          Cari
        </button>
        {q && (
          <a
            href="/data-pelanggan"
            className="px-2 py-2 text-xs text-[color:var(--muted)] hover:text-ink"
          >
            Reset
          </a>
        )}
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="px-3 py-2 bg-brand-600 text-white rounded-md text-sm flex items-center gap-1"
        >
          <Plus size={16} /> Tambah
        </button>
      </form>

      {(creating || editing) && (
        <div className="bg-surface rounded-xl border border-line p-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-semibold">{editing ? `Edit: ${editing.nama}` : "Tambah Pelanggan"}</h2>
            <button
              onClick={() => {
                setEditing(null);
                setCreating(false);
              }}
              className="text-[color:var(--muted)]"
            >
              <X size={18} />
            </button>
          </div>
          <PelangganForm
            initial={editing ?? undefined}
            onDone={() => {
              setEditing(null);
              setCreating(false);
            }}
          />
        </div>
      )}

      <div className="bg-surface rounded-xl border border-line overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[color:var(--surface2)] text-[color:var(--muted)] text-left">
            <tr>
              <th className="p-3">Nama</th>
              <th className="p-3 hidden sm:table-cell">Telp</th>
              <th className="p-3 hidden md:table-cell">Alamat</th>
              <th className="p-3 hidden sm:table-cell">Tipe</th>
              <th className="p-3 hidden md:table-cell text-right">Titipan</th>
              <th className="p-3 hidden lg:table-cell">Akun User</th>
              <th className="p-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filtered.map((p) => (
              <tr key={p.id} className="hover:bg-[color:var(--surface2)]">
                <td className="p-3 font-medium">
                  <Link
                    href={`/data-pelanggan/${p.id}`}
                    className="hover:text-brand hover:underline"
                  >
                    {p.nama}
                  </Link>
                  {/* show telp & alamat as sub-line on mobile */}
                  <div className="sm:hidden text-xs text-[color:var(--muted)] mt-0.5 space-y-0.5">
                    {p.telp && <div>📞 {p.telp}</div>}
                    {p.alamat && <div className="line-clamp-1">📍 {p.alamat}</div>}
                    <div className="flex items-center gap-2 flex-wrap mt-1">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] ${
                          p.tipe === "langganan"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-[color:var(--surface2)] text-[color:var(--muted)]"
                        }`}
                      >
                        {p.tipe}
                      </span>
                      {p.linkedUser ? (
                        <span className="text-[10px] inline-flex items-center gap-0.5 text-emerald-700 font-bold">
                          <UserCheck size={10} /> Tertaut
                        </span>
                      ) : (
                        <span className="text-[10px] inline-flex items-center gap-0.5 text-[color:var(--muted)]">
                          <UserX size={10} /> Walk-in
                        </span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="p-3 hidden sm:table-cell">{p.telp ?? "-"}</td>
                <td className="p-3 max-w-xs truncate hidden md:table-cell">{p.alamat ?? "-"}</td>
                <td className="p-3 hidden sm:table-cell">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs ${
                      p.tipe === "langganan"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-[color:var(--surface2)] text-[color:var(--muted)]"
                    }`}
                  >
                    {p.tipe}
                  </span>
                </td>
                <td className="p-3 hidden md:table-cell text-right">
                  {(p.titipanTotal ?? 0) > 0 ? (
                    <span className="text-xs font-bold text-brand inline-flex items-center gap-1">
                      <Package size={11} />
                      {p.titipanTotal}
                    </span>
                  ) : (
                    <span className="text-xs text-[color:var(--muted)]">—</span>
                  )}
                </td>
                <td className="p-3 hidden lg:table-cell">
                  {p.linkedUser ? (
                    <div className="text-xs">
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                        <UserCheck size={11} /> Tertaut
                      </span>
                      <div className="text-[10px] text-[color:var(--muted)] mt-0.5 max-w-[180px] truncate">
                        {p.linkedUser.username
                          ? `@${p.linkedUser.username}`
                          : p.linkedUser.email}
                      </div>
                    </div>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-[color:var(--muted)]">
                      <UserX size={11} /> Walk-in
                    </span>
                  )}
                </td>
                <td className="p-3 text-right space-x-2">
                  <Link
                    href={`/data-pelanggan/${p.id}`}
                    className="text-[color:var(--muted)] hover:text-brand inline-block"
                    title="Lihat detail & loyalty"
                  >
                    <Eye size={14} />
                  </Link>
                  <button
                    onClick={() => setEditing(p)}
                    className="text-brand"
                    title="Edit"
                  >
                    <Pencil size={14} />
                  </button>
                  {canDelete && (
                    <button
                      onClick={() => {
                        if (confirm(`Hapus ${p.nama}?`)) {
                          startTransition(() => deletePelanggan(p.id));
                        }
                      }}
                      className="text-red-500"
                      title="Hapus (admin)"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-[color:var(--muted)]">
                  Tidak ada data.
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

function PelangganForm({ initial, onDone }: { initial?: Pelanggan; onDone: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [lat, setLat] = useState<number | null>(initial?.koordinatLat ?? null);
  const [lng, setLng] = useState<number | null>(initial?.koordinatLng ?? null);

  return (
    <form
      action={(fd) => {
        setError(null);
        startTransition(async () => {
          try {
            await upsertPelanggan(fd);
            onDone();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Gagal");
          }
        });
      }}
      className="grid sm:grid-cols-2 gap-3 text-sm"
    >
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <Input label="Nama" name="nama" defaultValue={initial?.nama} required />
      <Input label="Telp" name="telp" defaultValue={initial?.telp ?? ""} />
      <div className="sm:col-span-2">
        <label className="block text-xs font-medium text-[color:var(--muted)] mb-0.5">Alamat</label>
        <textarea
          name="alamat"
          defaultValue={initial?.alamat ?? ""}
          rows={2}
          className="w-full px-2.5 py-1.5 border border-line rounded-md"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-[color:var(--muted)] mb-0.5">Tipe</label>
        <select
          name="tipe"
          defaultValue={initial?.tipe ?? "umum"}
          className="w-full px-2.5 py-1.5 border border-line rounded-md"
        >
          <option value="umum">Umum</option>
          <option value="langganan">Langganan</option>
        </select>
      </div>
      <Input label="Catatan" name="catatan" defaultValue={initial?.catatan ?? ""} />
      <div className="sm:col-span-2">
        <label className="block text-xs font-medium text-[color:var(--muted)] mb-1 inline-flex items-center gap-1">
          <MapPin size={12} /> Koordinat Lokasi
        </label>
        <input type="hidden" name="koordinatLat" value={lat ?? ""} />
        <input type="hidden" name="koordinatLng" value={lng ?? ""} />
        <LocationPicker
          lat={lat}
          lng={lng}
          onChange={(la, ln) => {
            if (isNaN(la) || isNaN(ln)) {
              setLat(null);
              setLng(null);
            } else {
              setLat(la);
              setLng(ln);
            }
          }}
        />
      </div>
      <div className="sm:col-span-2 flex justify-end gap-2">
        {error && <span className="text-red-600 text-xs self-center mr-auto">{error}</span>}
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 bg-brand-600 text-white rounded-md disabled:opacity-50"
        >
          {pending ? "Menyimpan..." : initial ? "Perbarui" : "Simpan"}
        </button>
      </div>
    </form>
  );
}

function Input({
  label,
  name,
  defaultValue,
  required,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-[color:var(--muted)] mb-0.5">{label}</label>
      <input
        name={name}
        defaultValue={defaultValue}
        required={required}
        className="w-full px-2.5 py-1.5 border border-line rounded-md"
      />
    </div>
  );
}
