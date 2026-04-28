"use client";

import { useState, useTransition } from "react";
import { Plus, Minus } from "lucide-react";
import { mutasiManual } from "./actions";

type ProdukStok = { id: number; nama: string; terisi: number; kosong: number; rusak: number };
type Mutasi = {
  id: number;
  produkId: number;
  status: "kosong" | "terisi" | "rusak";
  perubahan: number;
  alasan: string;
  createdAt: string;
  namaProduk: string | null;
  userName: string | null;
};

export function InventoryClient({
  produk,
  mutasi,
}: {
  produk: ProdukStok[];
  mutasi: Mutasi[];
}) {
  const [open, setOpen] = useState<{ produkId: number; status: "kosong" | "terisi" | "rusak"; sign: 1 | -1 } | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-3 gap-3">
        {produk.map((p) => (
          <div key={p.id} className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="font-medium mb-3">{p.nama}</div>
            <div className="space-y-1.5 text-sm">
              <StokRow
                label="Terisi"
                jumlah={p.terisi}
                color="text-emerald-700"
                onAdd={() => setOpen({ produkId: p.id, status: "terisi", sign: 1 })}
                onSub={() => setOpen({ produkId: p.id, status: "terisi", sign: -1 })}
              />
              <StokRow
                label="Kosong"
                jumlah={p.kosong}
                color="text-amber-700"
                onAdd={() => setOpen({ produkId: p.id, status: "kosong", sign: 1 })}
                onSub={() => setOpen({ produkId: p.id, status: "kosong", sign: -1 })}
              />
              <StokRow
                label="Rusak"
                jumlah={p.rusak}
                color="text-red-700"
                onAdd={() => setOpen({ produkId: p.id, status: "rusak", sign: 1 })}
                onSub={() => setOpen({ produkId: p.id, status: "rusak", sign: -1 })}
              />
            </div>
          </div>
        ))}
      </div>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-20 p-4">
          <form
            action={(fd) => {
              setError(null);
              startTransition(async () => {
                try {
                  await mutasiManual(fd);
                  setOpen(null);
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Gagal");
                }
              });
            }}
            className="bg-white rounded-xl p-5 w-full max-w-sm space-y-3"
          >
            <h2 className="font-semibold">
              {open.sign === 1 ? "Tambah" : "Kurangi"} stok {open.status} —{" "}
              {produk.find((p) => p.id === open.produkId)?.nama}
            </h2>
            <input type="hidden" name="produkId" value={open.produkId} />
            <input type="hidden" name="status" value={open.status} />
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Jumlah</label>
              <input
                type="number"
                name="perubahan"
                defaultValue={open.sign}
                step={1}
                className="w-full px-3 py-2 border border-slate-300 rounded-md"
              />
              <p className="text-xs text-slate-500 mt-1">
                Gunakan angka negatif untuk mengurangi.
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Alasan</label>
              <input
                name="alasan"
                required
                placeholder="Mis. setor air baru, galon pecah, koreksi"
                className="w-full px-3 py-2 border border-slate-300 rounded-md"
              />
            </div>
            {error && <div className="text-red-600 text-xs">{error}</div>}
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setOpen(null)}
                className="px-3 py-1.5 text-slate-600"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={pending}
                className="px-4 py-1.5 bg-brand-600 text-white rounded-md disabled:opacity-50"
              >
                {pending ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 font-medium text-sm">
          Riwayat Mutasi (50 terbaru)
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 text-left text-xs">
            <tr>
              <th className="p-3">Waktu</th>
              <th className="p-3">Produk</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Perubahan</th>
              <th className="p-3">Alasan</th>
              <th className="p-3">Oleh</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {mutasi.map((m) => (
              <tr key={m.id}>
                <td className="p-3 text-xs text-slate-500">
                  {new Date(m.createdAt).toLocaleString("id-ID")}
                </td>
                <td className="p-3">{m.namaProduk}</td>
                <td className="p-3">{m.status}</td>
                <td
                  className={`p-3 text-right font-medium ${
                    m.perubahan > 0 ? "text-emerald-700" : "text-red-700"
                  }`}
                >
                  {m.perubahan > 0 ? `+${m.perubahan}` : m.perubahan}
                </td>
                <td className="p-3 text-xs">{m.alasan}</td>
                <td className="p-3 text-xs text-slate-500">{m.userName ?? "-"}</td>
              </tr>
            ))}
            {mutasi.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-slate-400">
                  Belum ada mutasi.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StokRow({
  label,
  jumlah,
  color,
  onAdd,
  onSub,
}: {
  label: string;
  jumlah: number;
  color: string;
  onAdd: () => void;
  onSub: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-600">{label}</span>
      <div className="flex items-center gap-2">
        <button onClick={onSub} className="w-6 h-6 rounded border border-slate-300">
          <Minus size={12} className="mx-auto" />
        </button>
        <span className={`w-8 text-center font-bold ${color}`}>{jumlah}</span>
        <button onClick={onAdd} className="w-6 h-6 rounded border border-slate-300">
          <Plus size={12} className="mx-auto" />
        </button>
      </div>
    </div>
  );
}
