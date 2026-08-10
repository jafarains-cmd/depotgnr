import { and, eq, gte, lte, sql, isNull, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { transaksi } from "@/db/schema/transaksi";
import { orderHeader } from "@/db/schema/order";
import { pengeluaran } from "@/db/schema/pengeluaran";
import { filter } from "@/db/schema/filter";
import { kategoriBiaya } from "@/db/schema/kategori-biaya";

/**
 * Hitung analisis laba untuk periode tertentu.
 *
 * Formula:
 *   Omzet Bersih = POS + Order lunas (non-void) di periode
 *   COGS         = pengeluaran (kategori.tipe=cogs) + amortisasi sparepart aktif
 *   Laba Kotor   = Omzet - COGS
 *   Op. Expense  = pengeluaran (kategori.tipe=operasional)
 *   Laba Bersih  = Laba Kotor - Op. Expense
 *
 * Amortisasi filter:
 *   Untuk setiap filter dengan kategoriBiayaId + hargaBeli + tanggalPasang + aktif:
 *     biayaAmortisasiPeriode = hargaBeli × (hari_overlap_di_periode / intervalHari)
 */

export type LabaSummary = {
  from: Date;
  to: Date;
  hariDiPeriode: number;

  // Omzet
  omzetPOS: number;
  omzetOrder: number;
  omzetTotal: number;

  // COGS (Cost of Goods Sold)
  cogsCash: number; // dari pengeluaran kategori cogs
  cogsAmortisasi: number; // dari filter yang di-link ke master sparepart
  cogsTotal: number;

  // Op Expense
  opExCash: number;

  // Laba
  labaKotor: number;
  labaKotorPersen: number; // % dari omzet
  labaBersih: number;
  labaBersihPersen: number;

  // Uncategorized fallback (pengeluaran tanpa link master)
  pengeluaranTanpaKategori: number;
};

export type BreakdownItem = {
  kategoriId: number | null;
  slug: string | null;
  nama: string;
  tipe: "cogs" | "operasional" | "sparepart" | "uncategorized";
  jumlah: number;
  count: number;
};

export type AmortisasiItem = {
  filterId: number;
  filterNama: string;
  kategoriNama: string;
  hargaBeli: number;
  intervalHari: number;
  tanggalPasang: Date;
  hariAktifDiPeriode: number;
  biayaBulanIni: number;
  // Info tambahan
  progressPersen: number; // 0-100+ (>100 = sudah lewat umur)
};

/**
 * Overlap 2 range date, return jumlah hari.
 */
function hitungOverlapHari(
  rangeStart: Date,
  rangeEnd: Date,
  periodeStart: Date,
  periodeEnd: Date,
): number {
  const start = Math.max(rangeStart.getTime(), periodeStart.getTime());
  const end = Math.min(rangeEnd.getTime(), periodeEnd.getTime());
  if (end < start) return 0;
  const MS = 24 * 60 * 60 * 1000;
  return Math.max(0, Math.round((end - start) / MS));
}

/**
 * Hitung ringkasan laba untuk periode from..to.
 */
export async function hitungLaba(from: Date, to: Date): Promise<{
  summary: LabaSummary;
  breakdownCOGS: BreakdownItem[];
  breakdownOp: BreakdownItem[];
  amortisasiDetail: AmortisasiItem[];
}> {
  const MS = 24 * 60 * 60 * 1000;
  const hariDiPeriode = Math.max(1, Math.round((to.getTime() - from.getTime()) / MS));

  // 1. Omzet POS (transaksi, exclude yang refOrderId — order lunas di-count via orderHeader)
  const [posRow] = await db
    .select({
      total: sql<number>`coalesce(sum(${transaksi.total}), 0)`,
    })
    .from(transaksi)
    .where(
      and(
        isNull(transaksi.refOrderId),
        eq(transaksi.status, "lunas"),
        isNull(transaksi.voidedAt),
        gte(transaksi.createdAt, from),
        lte(transaksi.createdAt, to),
      ),
    );

  // 2. Omzet Order lunas (pakai bayarAt)
  const [orderRow] = await db
    .select({
      total: sql<number>`coalesce(sum(${orderHeader.totalEstimasi}), 0)`,
    })
    .from(orderHeader)
    .where(
      and(
        eq(orderHeader.statusBayar, "lunas"),
        isNotNull(orderHeader.bayarAt),
        gte(orderHeader.bayarAt, from),
        lte(orderHeader.bayarAt, to),
      ),
    );

  const omzetPOS = Number(posRow?.total ?? 0);
  const omzetOrder = Number(orderRow?.total ?? 0);
  const omzetTotal = omzetPOS + omzetOrder;

  // 3. Pengeluaran cash — group by kategori_biaya (join master)
  // Query dengan LEFT JOIN supaya pengeluaran tanpa link master tetap terhitung
  const pengeluaranRows = await db
    .select({
      kategoriId: kategoriBiaya.id,
      slug: kategoriBiaya.slug,
      nama: kategoriBiaya.nama,
      tipe: kategoriBiaya.tipe,
      // Fallback slug lama dari pengeluaran.kategori kalau tidak ter-link
      pengeluaranKategori: pengeluaran.kategori,
      jumlah: sql<number>`coalesce(sum(${pengeluaran.jumlah}), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(pengeluaran)
    .leftJoin(
      kategoriBiaya,
      eq(pengeluaran.kategoriBiayaId, kategoriBiaya.id),
    )
    .where(
      and(
        gte(pengeluaran.tanggal, from),
        lte(pengeluaran.tanggal, to),
      ),
    )
    .groupBy(kategoriBiaya.id, pengeluaran.kategori);

  // Kelompokkan: cogs / operasional / uncategorized
  const breakdownCOGS: BreakdownItem[] = [];
  const breakdownOp: BreakdownItem[] = [];
  let cogsCash = 0;
  let opExCash = 0;
  let pengeluaranTanpaKategori = 0;

  // Untuk fallback: cari kategori by slug lama supaya data legacy bisa diklasifikasi
  const slugFallbackMap = new Map<string, {
    id: number;
    nama: string;
    tipe: "cogs" | "operasional" | "sparepart";
  }>();
  const allKategori = await db.select().from(kategoriBiaya);
  for (const k of allKategori) {
    slugFallbackMap.set(k.slug, {
      id: k.id,
      nama: k.nama,
      tipe: k.tipe as "cogs" | "operasional" | "sparepart",
    });
  }

  for (const row of pengeluaranRows) {
    const jumlah = Number(row.jumlah);
    const count = Number(row.count);

    // Resolve tipe: prioritas FK, fallback slug lookup
    let tipe: "cogs" | "operasional" | "sparepart" | "uncategorized" = "uncategorized";
    let kategoriId: number | null = row.kategoriId;
    let nama = row.nama ?? "";
    let slug: string | null = row.slug;

    if (row.kategoriId && row.tipe) {
      tipe = row.tipe as "cogs" | "operasional" | "sparepart";
    } else if (row.pengeluaranKategori) {
      const fallback = slugFallbackMap.get(row.pengeluaranKategori);
      if (fallback) {
        tipe = fallback.tipe;
        kategoriId = fallback.id;
        nama = fallback.nama;
        slug = row.pengeluaranKategori;
      } else {
        // Slug lama yang tidak ada di master → tampilkan slug title-case
        nama = row.pengeluaranKategori
          .replace(/-/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase());
        slug = row.pengeluaranKategori;
      }
    }

    const item: BreakdownItem = { kategoriId, slug, nama, tipe, jumlah, count };

    if (tipe === "cogs") {
      cogsCash += jumlah;
      breakdownCOGS.push(item);
    } else if (tipe === "operasional") {
      opExCash += jumlah;
      breakdownOp.push(item);
    } else if (tipe === "sparepart") {
      // Sparepart yang dicatat via pengeluaran (bukan pemeliharaan) — treat as COGS one-shot
      cogsCash += jumlah;
      breakdownCOGS.push(item);
    } else {
      pengeluaranTanpaKategori += jumlah;
      // Uncategorized masuk breakdown Op supaya user aware ada yang perlu di-klasifikasi
      breakdownOp.push(item);
    }
  }

  // 4. Amortisasi sparepart aktif (dari tabel filter yang link ke master)
  const filterRows = await db
    .select({
      id: filter.id,
      nama: filter.nama,
      intervalHari: filter.intervalHari,
      hargaBeli: filter.hargaBeli,
      tanggalPasang: filter.tanggalPasang,
      gantiTerakhir: filter.gantiTerakhir,
      kategoriBiayaId: filter.kategoriBiayaId,
      kategoriNama: kategoriBiaya.nama,
    })
    .from(filter)
    .leftJoin(kategoriBiaya, eq(filter.kategoriBiayaId, kategoriBiaya.id))
    .where(
      and(
        eq(filter.aktif, true),
        isNotNull(filter.kategoriBiayaId),
        isNotNull(filter.hargaBeli),
      ),
    );

  const amortisasiDetail: AmortisasiItem[] = [];
  let cogsAmortisasi = 0;

  for (const f of filterRows) {
    if (!f.hargaBeli || !f.intervalHari) continue;
    // Tanggal pasang: prioritas field baru, fallback ke gantiTerakhir, fallback ke null (skip)
    const pasang = f.tanggalPasang ?? f.gantiTerakhir;
    if (!pasang) continue;

    // Range pakai sparepart: pasang .. pasang + intervalHari
    const rangeStart = new Date(pasang);
    const rangeEnd = new Date(pasang.getTime() + f.intervalHari * MS);

    const hariOverlap = hitungOverlapHari(rangeStart, rangeEnd, from, to);
    if (hariOverlap === 0) continue;

    const biayaBulanIni = Math.round((f.hargaBeli * hariOverlap) / f.intervalHari);
    cogsAmortisasi += biayaBulanIni;

    // Progress: seberapa lama filter sudah dipakai dibanding umur estimasi
    const hariSudahDipakai = Math.max(0, Math.round((to.getTime() - pasang.getTime()) / MS));
    const progressPersen = Math.round((hariSudahDipakai / f.intervalHari) * 100);

    amortisasiDetail.push({
      filterId: f.id,
      filterNama: f.nama,
      kategoriNama: f.kategoriNama ?? "—",
      hargaBeli: f.hargaBeli,
      intervalHari: f.intervalHari,
      tanggalPasang: pasang,
      hariAktifDiPeriode: hariOverlap,
      biayaBulanIni,
      progressPersen,
    });
  }

  // 5. Kalkulasi akhir
  const cogsTotal = cogsCash + cogsAmortisasi;
  const labaKotor = omzetTotal - cogsTotal;
  const labaBersih = labaKotor - opExCash;
  const labaKotorPersen = omzetTotal > 0 ? (labaKotor / omzetTotal) * 100 : 0;
  const labaBersihPersen = omzetTotal > 0 ? (labaBersih / omzetTotal) * 100 : 0;

  // Sort breakdown by jumlah desc
  breakdownCOGS.sort((a, b) => b.jumlah - a.jumlah);
  breakdownOp.sort((a, b) => b.jumlah - a.jumlah);
  amortisasiDetail.sort((a, b) => b.biayaBulanIni - a.biayaBulanIni);

  const summary: LabaSummary = {
    from,
    to,
    hariDiPeriode,
    omzetPOS,
    omzetOrder,
    omzetTotal,
    cogsCash,
    cogsAmortisasi,
    cogsTotal,
    opExCash,
    labaKotor,
    labaKotorPersen,
    labaBersih,
    labaBersihPersen,
    pengeluaranTanpaKategori,
  };

  return { summary, breakdownCOGS, breakdownOp, amortisasiDetail };
}
