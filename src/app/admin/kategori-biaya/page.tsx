import { asc } from "drizzle-orm";
import { db } from "@/db";
import { kategoriBiaya } from "@/db/schema/kategori-biaya";
import { PageHeader } from "@/components/AppShell";
import { requireRole } from "@/lib/permissions";
import { KategoriBiayaClient } from "./KategoriBiayaClient";

export const dynamic = "force-dynamic";

export default async function KategoriBiayaPage() {
  await requireRole(["admin"]);

  const rows = await db
    .select()
    .from(kategoriBiaya)
    .orderBy(asc(kategoriBiaya.tipe), asc(kategoriBiaya.urutan), asc(kategoriBiaya.nama));

  return (
    <div className="p-4 md:p-6 max-w-5xl space-y-4">
      <PageHeader
        title="Kategori Biaya"
        description='Master data kategori untuk pengeluaran, pemeliharaan, dan sparepart. Dipakai auto-hitung "Analisis Laba".'
      />

      <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 text-xs text-sky-900 leading-relaxed">
        <b>3 tipe kategori:</b>
        <ul className="list-disc list-inside mt-1 space-y-0.5">
          <li>
            <b>COGS</b> — biaya langsung produk (air baku, listrik produksi, sabun cuci galon).
          </li>
          <li>
            <b>Operasional</b> — biaya jalan bisnis (bensin, ongkos kurir, gaji, sewa).
          </li>
          <li>
            <b>Sparepart</b> — barang tahan lama yang di-amortisasi (membran, filter, mesin).
            Biaya tersebar rata sesuai umur pakai.
          </li>
        </ul>
      </div>

      <KategoriBiayaClient
        rows={rows.map((r) => ({
          id: r.id,
          slug: r.slug,
          nama: r.nama,
          tipe: r.tipe as "cogs" | "operasional" | "sparepart",
          umurHariDefault: r.umurHariDefault,
          hargaEstimasi: r.hargaEstimasi,
          urutan: r.urutan,
          aktif: r.aktif,
          isSystem: r.isSystem,
        }))}
      />
    </div>
  );
}
