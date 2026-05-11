import { db } from "@/db";
import { formatRupiah } from "@/lib/utils";
import { PageHeader } from "@/components/AppShell";
import { ProdukRow } from "./ProdukRow";
import { ProdukForm } from "./ProdukForm";

export const dynamic = "force-dynamic";

export default async function ProdukPage() {
  const list = await db.query.produk.findMany({ orderBy: (p, { asc }) => [asc(p.id)] });

  return (
    <div className="p-4 md:p-6">
      <PageHeader title="Produk" description="Kelola jenis galon, kemasan, dan harga." />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-surface rounded-xl border border-line overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[color:var(--surface2)] text-[color:var(--muted)]">
              <tr className="text-left">
                <th className="p-3">Nama</th>
                <th className="p-3 text-right">Isi Ulang</th>
                <th className="p-3 text-right hidden sm:table-cell">Tukar</th>
                <th className="p-3 text-right hidden sm:table-cell">Beli Baru</th>
                <th className="p-3 hidden md:table-cell">Status</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
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
                  <td colSpan={6} className="p-4 md:p-6 text-center text-[color:var(--muted)]">
                    Belum ada produk.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </div>

        <div className="bg-surface rounded-xl border border-line p-4">
          <h2 className="font-semibold mb-3">Tambah Produk</h2>
          <ProdukForm />
        </div>
      </div>
    </div>
  );
}
