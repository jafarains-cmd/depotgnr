import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { filter, filterLog } from "@/db/schema/filter";
import { user as userTable } from "@/db/schema/auth";
import { PageHeader } from "@/components/AppShell";
import { requireRole } from "@/lib/permissions";
import { PemeliharaanClient } from "./PemeliharaanClient";
import { KATEGORI_FILTER } from "./kategori";
import { computeFilterStatus } from "@/lib/filter-status";
import { getKategoriAktif } from "@/lib/kategori-biaya";

export const dynamic = "force-dynamic";

export default async function PemeliharaanPage() {
  await requireRole(["admin"]);

  const filters = await db.query.filter.findMany({
    orderBy: (f, { asc }) => [asc(f.aktif), asc(f.id)],
  });

  // Latest 30 log entries (gabungan semua filter)
  const recentLogs = await db
    .select({
      id: filterLog.id,
      filterId: filterLog.filterId,
      filterNama: filter.nama,
      gantiAt: filterLog.gantiAt,
      biaya: filterLog.biaya,
      catatan: filterLog.catatan,
      gantiByName: userTable.name,
    })
    .from(filterLog)
    .leftJoin(filter, eq(filterLog.filterId, filter.id))
    .leftJoin(userTable, eq(filterLog.gantiBy, userTable.id))
    .orderBy(desc(filterLog.gantiAt))
    .limit(30);

  const rows = filters.map((f) => {
    const s = computeFilterStatus({
      gantiTerakhir: f.gantiTerakhir,
      intervalHari: f.intervalHari,
    });
    return {
      id: f.id,
      nama: f.nama,
      kategori: f.kategori,
      intervalHari: f.intervalHari,
      gantiTerakhir: f.gantiTerakhir?.toISOString() ?? null,
      catatan: f.catatan,
      aktif: f.aktif,
      status: s.status,
      daysLeft: s.daysLeft,
      nextDueAt: s.nextDueAt?.toISOString() ?? null,
      kategoriBiayaId: f.kategoriBiayaId,
      hargaBeli: f.hargaBeli,
      tanggalPasang: f.tanggalPasang?.toISOString() ?? null,
    };
  });

  // Sparepart master untuk auto-fill amortisasi
  const sparepartMaster = await getKategoriAktif("sparepart");

  return (
    <div className="p-4 md:p-6 max-w-5xl space-y-4">
      <PageHeader
        title="Pemeliharaan Filter"
        description="Jadwal ganti carbon, sediment, membran RO, dll. Alert dashboard kalau lewat jadwal."
      />

      <PemeliharaanClient
        rows={rows}
        kategoriOptions={[...KATEGORI_FILTER]}
        sparepartMaster={sparepartMaster.map((k) => ({
          id: k.id,
          nama: k.nama,
          umurHariDefault: k.umurHariDefault,
          hargaEstimasi: k.hargaEstimasi,
        }))}
        recentLogs={recentLogs.map((l) => ({
          id: l.id,
          filterId: l.filterId,
          filterNama: l.filterNama ?? "—",
          gantiAt: l.gantiAt.toISOString(),
          biaya: l.biaya,
          catatan: l.catatan,
          gantiByName: l.gantiByName,
        }))}
      />
    </div>
  );
}
