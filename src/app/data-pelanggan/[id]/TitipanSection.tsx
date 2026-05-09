"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Package,
  ArrowDownToLine,
  ArrowUpFromLine,
  Loader2,
  X,
  History,
} from "lucide-react";
import { catatMutasiTitipan } from "../actions";
import { useFormatTanggal } from "@/components/TimezoneContext";

export type TitipanRow = {
  produkId: number;
  produkNama: string;
  jumlahDititip: number;
};

export type MutasiRow = {
  id: number;
  produkId: number;
  produkNama: string;
  perubahan: number;
  alasan: string;
  catatan: string | null;
  createdAt: string;
  userName: string | null;
};

export function TitipanSection({
  pelangganId,
  pelangganNama,
  titipan,
  semuaProduk,
  recentMutasi,
}: {
  pelangganId: number;
  pelangganNama: string;
  titipan: TitipanRow[];
  semuaProduk: { id: number; nama: string }[];
  recentMutasi: MutasiRow[];
}) {
  const fmt = useFormatTanggal();
  const [formFor, setFormFor] = useState<{
    produkId: number;
    produkNama: string;
    arah: "in" | "out";
  } | null>(null);

  const total = titipan.reduce((s, t) => s + t.jumlahDititip, 0);

  return (
    <div className="space-y-3">
      <div className="bg-surface border border-line rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-line flex items-center gap-2">
          <Package size={14} className="text-brand" />
          <h2 className="font-bold text-sm">Galon Dititipkan di Depot</h2>
          {total > 0 && (
            <span className="ml-auto text-xs font-bold text-brand">
              Total: {total} galon
            </span>
          )}
        </div>

        {titipan.length === 0 ? (
          <div className="p-6 text-center text-sm text-[color:var(--muted)] space-y-2">
            <div>Belum ada galon yang dititipkan.</div>
            <div className="flex flex-wrap gap-2 justify-center">
              {semuaProduk.map((p) => (
                <button
                  key={p.id}
                  onClick={() =>
                    setFormFor({ produkId: p.id, produkNama: p.nama, arah: "in" })
                  }
                  className="px-3 py-1.5 text-xs border border-line rounded-md hover:border-brand hover:text-brand inline-flex items-center gap-1"
                >
                  <ArrowDownToLine size={12} /> Terima titipan {p.nama}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[color:var(--surface2)] text-[color:var(--muted)] text-left text-xs">
              <tr>
                <th className="p-3">Produk</th>
                <th className="p-3 text-right">Dititipkan</th>
                <th className="p-3 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {titipan.map((t) => (
                <tr key={t.produkId}>
                  <td className="p-3 font-bold">{t.produkNama}</td>
                  <td className="p-3 text-right font-mono font-bold text-brand">
                    {t.jumlahDititip} galon
                  </td>
                  <td className="p-3 text-right whitespace-nowrap">
                    <button
                      onClick={() =>
                        setFormFor({
                          produkId: t.produkId,
                          produkNama: t.produkNama,
                          arah: "in",
                        })
                      }
                      className="text-emerald-600 hover:opacity-70 inline-block mr-2"
                      title="Terima titipan tambahan"
                    >
                      <ArrowDownToLine size={14} />
                    </button>
                    <button
                      onClick={() =>
                        setFormFor({
                          produkId: t.produkId,
                          produkNama: t.produkNama,
                          arah: "out",
                        })
                      }
                      disabled={t.jumlahDititip === 0}
                      className="text-amber-600 hover:opacity-70 inline-block disabled:opacity-30"
                      title="Kembalikan / pakai titipan"
                    >
                      <ArrowUpFromLine size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {titipan.length > 0 && semuaProduk.length > titipan.length && (
          <div className="border-t border-line p-3 flex flex-wrap gap-2">
            {semuaProduk
              .filter((p) => !titipan.some((t) => t.produkId === p.id))
              .map((p) => (
                <button
                  key={p.id}
                  onClick={() =>
                    setFormFor({ produkId: p.id, produkNama: p.nama, arah: "in" })
                  }
                  className="px-2 py-1 text-[11px] border border-line rounded-md hover:border-brand hover:text-brand inline-flex items-center gap-1"
                >
                  <ArrowDownToLine size={10} /> Terima {p.nama}
                </button>
              ))}
          </div>
        )}
      </div>

      {formFor && (
        <TitipanForm
          pelangganId={pelangganId}
          pelangganNama={pelangganNama}
          produkId={formFor.produkId}
          produkNama={formFor.produkNama}
          arah={formFor.arah}
          onClose={() => setFormFor(null)}
        />
      )}

      {recentMutasi.length > 0 && (
        <div className="bg-surface border border-line rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-line flex items-center gap-2">
            <History size={14} className="text-[color:var(--muted)]" />
            <h2 className="font-bold text-sm">Riwayat Titipan</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-[color:var(--surface2)] text-[color:var(--muted)] text-left text-xs">
              <tr>
                <th className="p-3">Tanggal</th>
                <th className="p-3">Produk</th>
                <th className="p-3 text-right">Perubahan</th>
                <th className="p-3 hidden sm:table-cell">Alasan</th>
                <th className="p-3 hidden md:table-cell">Petugas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {recentMutasi.map((m) => (
                <tr key={m.id}>
                  <td className="p-3 text-xs whitespace-nowrap">
                    {fmt(m.createdAt, { dateStyle: "short", timeStyle: "short" })}
                  </td>
                  <td className="p-3 text-xs">{m.produkNama}</td>
                  <td
                    className={`p-3 text-right font-mono font-bold text-xs whitespace-nowrap ${
                      m.perubahan > 0 ? "text-emerald-700" : "text-amber-700"
                    }`}
                  >
                    {m.perubahan > 0 ? "+" : ""}
                    {m.perubahan} galon
                  </td>
                  <td className="p-3 text-xs hidden sm:table-cell">{m.alasan}</td>
                  <td className="p-3 text-xs hidden md:table-cell">
                    {m.userName ?? "—"}
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

function TitipanForm({
  pelangganId,
  pelangganNama,
  produkId,
  produkNama,
  arah,
  onClose,
}: {
  pelangganId: number;
  pelangganNama: string;
  produkId: number;
  produkNama: string;
  arah: "in" | "out";
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [jumlah, setJumlah] = useState("1");
  const [alasan, setAlasan] = useState(
    arah === "in" ? "Pelanggan titip galon" : "Pelanggan ambil titipan",
  );
  const [catatan, setCatatan] = useState("");

  const isMasuk = arah === "in";
  const colorClass = isMasuk
    ? "bg-emerald-50 border-emerald-200"
    : "bg-amber-50 border-amber-200";

  function submit() {
    setError(null);
    const n = parseInt(jumlah, 10);
    if (!Number.isFinite(n) || n <= 0) {
      setError("Jumlah harus angka positif");
      return;
    }
    const perubahan = isMasuk ? n : -n;
    startTransition(async () => {
      const r = await catatMutasiTitipan({
        pelangganId,
        produkId,
        perubahan,
        alasan,
        catatan,
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
          {isMasuk ? "Terima Titipan" : "Kembalikan Titipan"} · {produkNama}
        </h2>
        <button onClick={onClose} className="text-[color:var(--muted)]">
          <X size={18} />
        </button>
      </div>
      <div className="text-xs text-[color:var(--muted)]">
        Pelanggan: <strong>{pelangganNama}</strong>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium block mb-1">Jumlah (galon)</label>
          <input
            type="number"
            min={1}
            value={jumlah}
            onChange={(e) => setJumlah(e.target.value)}
            className="w-full px-3 py-2 border border-line rounded-md text-sm font-mono"
          />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">Alasan</label>
          <input
            value={alasan}
            onChange={(e) => setAlasan(e.target.value)}
            className="w-full px-3 py-2 border border-line rounded-md text-sm"
          />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium block mb-1">Catatan (opsional)</label>
        <textarea
          value={catatan}
          onChange={(e) => setCatatan(e.target.value)}
          rows={2}
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
          disabled={pending}
          className={`px-4 py-2 text-white rounded-md text-sm font-bold inline-flex items-center gap-1.5 disabled:opacity-50 ${
            isMasuk ? "bg-emerald-600" : "bg-amber-600"
          }`}
        >
          {pending && <Loader2 size={14} className="animate-spin" />}
          {isMasuk ? "Catat Terima" : "Catat Kembali"}
        </button>
      </div>
    </div>
  );
}
