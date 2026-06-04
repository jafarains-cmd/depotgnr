"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Truck, History, Loader2, X, Settings2 } from "lucide-react";
import { adjustGalonPinjamManual } from "../actions";
import { useFormatTanggal } from "@/components/TimezoneContext";

export type SaldoRow = {
  produkId: number;
  produkNama: string;
  jumlah: number;
};

export type GalonMutasiRow = {
  id: number;
  produkId: number;
  produkNama: string;
  perubahan: number;
  tipe: string;
  alasan: string | null;
  refTransaksiId: number | null;
  refOrderId: number | null;
  galonSerial: string | null;
  userName: string | null;
  createdAt: string;
};

export function GalonPinjamSection({
  pelangganId,
  pelangganNama,
  saldo,
  semuaProduk,
  recentMutasi,
  isAdmin,
}: {
  pelangganId: number;
  pelangganNama: string;
  saldo: SaldoRow[];
  semuaProduk: { id: number; nama: string }[];
  recentMutasi: GalonMutasiRow[];
  isAdmin: boolean;
}) {
  const fmt = useFormatTanggal();
  const [formFor, setFormFor] = useState<{
    produkId: number;
    produkNama: string;
  } | null>(null);

  const total = saldo.reduce((s, t) => s + t.jumlah, 0);

  return (
    <div className="space-y-3">
      <div className="bg-surface border border-line rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-line flex items-center gap-2">
          <Truck size={14} className="text-amber-600" />
          <h2 className="font-bold text-sm">Galon Depot Dipinjam Pelanggan</h2>
          {total > 0 && (
            <span className="ml-auto text-xs font-bold text-amber-700">
              Total: {total} galon
            </span>
          )}
        </div>

        {saldo.length === 0 ? (
          <div className="p-6 text-center text-sm text-[color:var(--muted)]">
            Pelanggan tidak memegang galon depot.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[color:var(--surface2)] text-[color:var(--muted)] text-left text-xs">
              <tr>
                <th className="p-3">Produk</th>
                <th className="p-3 text-right">Dipinjam</th>
                {isAdmin && <th className="p-3 text-right"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {saldo.map((t) => (
                <tr key={t.produkId}>
                  <td className="p-3 font-bold">{t.produkNama}</td>
                  <td className="p-3 text-right font-mono font-bold text-amber-700">
                    {t.jumlah} galon
                  </td>
                  {isAdmin && (
                    <td className="p-3 text-right whitespace-nowrap">
                      <button
                        onClick={() =>
                          setFormFor({
                            produkId: t.produkId,
                            produkNama: t.produkNama,
                          })
                        }
                        className="text-amber-600 hover:opacity-70 inline-block"
                        title="Adjust manual"
                      >
                        <Settings2 size={14} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {isAdmin && saldo.length === 0 && semuaProduk.length > 0 && (
          <div className="border-t border-line p-3 flex flex-wrap gap-2">
            {semuaProduk.map((p) => (
              <button
                key={p.id}
                onClick={() => setFormFor({ produkId: p.id, produkNama: p.nama })}
                className="px-2 py-1 text-[11px] border border-line rounded-md hover:border-brand hover:text-brand inline-flex items-center gap-1"
              >
                <Settings2 size={10} /> Catat manual {p.nama}
              </button>
            ))}
          </div>
        )}
      </div>

      {formFor && (
        <GalonAdjustForm
          pelangganId={pelangganId}
          pelangganNama={pelangganNama}
          produkId={formFor.produkId}
          produkNama={formFor.produkNama}
          onClose={() => setFormFor(null)}
        />
      )}

      {recentMutasi.length > 0 && (
        <div className="bg-surface border border-line rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-line flex items-center gap-2">
            <History size={14} className="text-[color:var(--muted)]" />
            <h2 className="font-bold text-sm">Riwayat Galon Dipinjam</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-[color:var(--surface2)] text-[color:var(--muted)] text-left text-xs">
              <tr>
                <th className="p-3">Tanggal</th>
                <th className="p-3">Produk</th>
                <th className="p-3 text-right">Perubahan</th>
                <th className="p-3 hidden sm:table-cell">Tipe</th>
                <th className="p-3 hidden md:table-cell">Alasan</th>
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
                      m.perubahan > 0 ? "text-amber-700" : "text-emerald-700"
                    }`}
                  >
                    {m.perubahan > 0 ? "+" : ""}
                    {m.perubahan}
                  </td>
                  <td className="p-3 text-xs hidden sm:table-cell capitalize">{m.tipe}</td>
                  <td className="p-3 text-xs hidden md:table-cell">
                    {m.alasan ?? (m.refTransaksiId ? `Trx #${m.refTransaksiId}` : m.refOrderId ? `Order #${m.refOrderId}` : "—")}
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

function GalonAdjustForm({
  pelangganId,
  pelangganNama,
  produkId,
  produkNama,
  onClose,
}: {
  pelangganId: number;
  pelangganNama: string;
  produkId: number;
  produkNama: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [perubahan, setPerubahan] = useState("0");
  const [alasan, setAlasan] = useState("");

  function submit() {
    setError(null);
    const n = parseInt(perubahan, 10);
    if (!Number.isFinite(n) || n === 0) {
      setError("Perubahan harus integer bukan nol (positif=tambah, negatif=kurang)");
      return;
    }
    if (alasan.trim().length < 3) {
      setError("Alasan wajib diisi");
      return;
    }
    startTransition(async () => {
      const r = await adjustGalonPinjamManual({
        pelangganId,
        produkId,
        perubahan: n,
        alasan,
      });
      if ("error" in r) setError(r.error);
      else {
        onClose();
        router.refresh();
      }
    });
  }

  return (
    <div className="border rounded-2xl p-4 space-y-3 bg-amber-50 border-amber-200">
      <div className="flex justify-between items-center">
        <h2 className="font-bold">Adjust Manual Galon Dipinjam · {produkNama}</h2>
        <button onClick={onClose} className="text-[color:var(--muted)]">
          <X size={18} />
        </button>
      </div>
      <div className="text-xs text-[color:var(--muted)]">
        Pelanggan: <strong>{pelangganNama}</strong>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium block mb-1">
            Perubahan (+ tambah, − kurang)
          </label>
          <input
            type="number"
            value={perubahan}
            onChange={(e) => setPerubahan(e.target.value)}
            className="w-full px-3 py-2 border border-line rounded-md text-sm font-mono"
          />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">Alasan</label>
          <input
            value={alasan}
            onChange={(e) => setAlasan(e.target.value)}
            placeholder="mis: koreksi stok, galon hilang"
            className="w-full px-3 py-2 border border-line rounded-md text-sm"
          />
        </div>
      </div>
      {error && <div className="text-xs text-red-600">{error}</div>}
      <div className="flex justify-end gap-2 pt-2 border-t border-line">
        <button onClick={onClose} className="px-4 py-2 border border-line rounded-md text-sm">
          Batal
        </button>
        <button
          onClick={submit}
          disabled={pending}
          className="px-4 py-2 text-white rounded-md text-sm font-bold inline-flex items-center gap-1.5 disabled:opacity-50 bg-amber-600"
        >
          {pending && <Loader2 size={14} className="animate-spin" />}
          Catat Adjust
        </button>
      </div>
    </div>
  );
}
