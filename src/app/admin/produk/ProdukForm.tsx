"use client";

import { useRef, useState, useTransition } from "react";
import { upsertProduk } from "./actions";

export function ProdukForm({
  initial,
  onDone,
}: {
  initial?: {
    id: number;
    nama: string;
    deskripsi: string | null;
    hargaIsiUlang: number;
    hargaTukar: number;
    hargaBeliBaru: number;
    aktif: boolean;
  };
  onDone?: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await upsertProduk(formData);
        formRef.current?.reset();
        onDone?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Gagal menyimpan");
      }
    });
  }

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-3 text-sm">
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <Field label="Nama" name="nama" defaultValue={initial?.nama ?? ""} required />
      <Field label="Deskripsi" name="deskripsi" defaultValue={initial?.deskripsi ?? ""} />
      <Field
        label="Harga Isi Ulang (Rp)"
        name="hargaIsiUlang"
        type="number"
        defaultValue={initial?.hargaIsiUlang ?? 0}
      />
      <Field
        label="Harga Tukar (Rp)"
        name="hargaTukar"
        type="number"
        defaultValue={initial?.hargaTukar ?? 0}
      />
      <Field
        label="Harga Beli Baru (Rp)"
        name="hargaBeliBaru"
        type="number"
        defaultValue={initial?.hargaBeliBaru ?? 0}
      />
      <label className="flex items-center gap-2">
        <input type="checkbox" name="aktif" defaultChecked={initial?.aktif ?? true} /> Aktif
      </label>

      {error && <div className="text-red-600 text-xs">{error}</div>}
      <button
        type="submit"
        disabled={pending}
        className="w-full py-2 bg-brand-600 text-white rounded-md hover:bg-brand-700 disabled:opacity-50"
      >
        {pending ? "Menyimpan..." : initial ? "Perbarui" : "Tambah"}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  defaultValue,
  required,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string | number;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-[color:var(--muted)] mb-0.5">{label}</label>
      <input
        type={type}
        name={name}
        defaultValue={defaultValue}
        required={required}
        className="w-full px-2.5 py-1.5 border border-line rounded-md"
      />
    </div>
  );
}
