import { db } from "@/db";
import { formatRupiah } from "@/lib/utils";
import { PageHeader } from "@/components/AppShell";
import { ProdukRow } from "./ProdukRow";
import { ProdukForm } from "./ProdukForm";

export const dynamic = "force-dynamic";

export default async function ProdukPage() {
  const list = await db.query.produk.findMany({ orderBy: (p, { asc }) => [asc(p.id)] });

  return (
    <div className="p-6">
      <PageHeader title="Produk" description="Kelola jenis galon, kemasan, dan harga." />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr className="text-left">
                <th className="p-3">Nama</th>
                <th className="p-3 text-right">Isi Ulang</th>
                <th className="p-3 text-right">Tukar</th>
                <th className="p-3 text-right">Beli Baru</th>
                <th className="p-3">Status</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.map((p) => (
                <ProdukRow
                  key={p.id}
                  produk={{
                    ...p,
                    hargaIsiUlangFmt: formatRupiah(p.hargaIsiUlang),
                    hargaTukarFmt: formatRupiah(p.hargaTukar),
                    hargaBeliBaruFmt: formatRupiah(p.hargaBeliBaru),
                  }}
                />
              ))}
              {list.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-400">
                    Belum ada produk.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h2 className="font-semibold mb-3">Tambah Produk</h2>
          <ProdukForm />
        </div>
      </div>
    </div>
  );
}
