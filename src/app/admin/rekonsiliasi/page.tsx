import { and, eq, gte, lte, sql, isNull, desc } from "drizzle-orm";
import { db } from "@/db";
import { transaksi } from "@/db/schema/transaksi";
import { orderHeader } from "@/db/schema/order";
import { rekonsiliasiBank } from "@/db/schema/rekonsiliasi-bank";
import { user as userTable } from "@/db/schema/auth";
import { PageHeader } from "@/components/AppShell";
import { requireRole } from "@/lib/permissions";
import { RekonsiliasiClient } from "./RekonsiliasiClient";

export const dynamic = "force-dynamic";

/**
 * Halaman Rekonsiliasi Bank Harian.
 *
 * Untuk 30 hari terakhir: hitung omzet transfer & qris per hari dari sistem,
 * gabungkan dengan entry rekonsiliasi yang sudah diverifikasi (kalau ada).
 * Admin input saldo aktual dari mobile banking / QRIS merchant, sistem
 * hitung selisih.
 */
export default async function RekonsiliasiPage({
  searchParams,
}: {
  searchParams: Promise<{ hari?: string }>;
}) {
  await requireRole(["admin"]);
  const sp = await searchParams;
  const hariCount = Math.max(7, Math.min(90, parseInt(sp.hari ?? "30", 10) || 30));

  // Range = hari ini - N hari sampai sekarang
  const now = new Date();
  const startRange = new Date(now);
  startRange.setDate(startRange.getDate() - (hariCount - 1));
  startRange.setHours(0, 0, 0, 0);
  const endRange = new Date(now);
  endRange.setHours(23, 59, 59, 999);

  // Query 1: aggregate omzet POS per hari per metode
  const posRows = await db
    .select({
      hari: sql<string>`strftime('%Y-%m-%d', ${transaksi.createdAt}, 'unixepoch', 'localtime')`,
      metode: transaksi.metodeBayar,
      total: sql<number>`coalesce(sum(${transaksi.total}), 0)`,
    })
    .from(transaksi)
    .where(
      and(
        isNull(transaksi.refOrderId),
        eq(transaksi.status, "lunas"),
        isNull(transaksi.voidedAt),
        gte(transaksi.createdAt, startRange),
        lte(transaksi.createdAt, endRange),
        sql`${transaksi.metodeBayar} in ('transfer', 'qris')`,
      ),
    )
    .groupBy(
      sql`strftime('%Y-%m-%d', ${transaksi.createdAt}, 'unixepoch', 'localtime')`,
      transaksi.metodeBayar,
    );

  // Query 2: aggregate omzet order lunas per hari per metode
  const orderRows = await db
    .select({
      hari: sql<string>`strftime('%Y-%m-%d', ${orderHeader.bayarAt}, 'unixepoch', 'localtime')`,
      metode: orderHeader.metodeBayar,
      total: sql<number>`coalesce(sum(${orderHeader.totalEstimasi}), 0)`,
    })
    .from(orderHeader)
    .where(
      and(
        eq(orderHeader.statusBayar, "lunas"),
        gte(orderHeader.bayarAt, startRange),
        lte(orderHeader.bayarAt, endRange),
        sql`${orderHeader.metodeBayar} in ('transfer', 'dana', 'qris')`,
      ),
    )
    .groupBy(
      sql`strftime('%Y-%m-%d', ${orderHeader.bayarAt}, 'unixepoch', 'localtime')`,
      orderHeader.metodeBayar,
    );

  // Query 3: entry rekonsiliasi yang sudah ada dalam range
  const rekonRows = await db
    .select({
      id: rekonsiliasiBank.id,
      tanggal: rekonsiliasiBank.tanggal,
      metode: rekonsiliasiBank.metode,
      omzetSistem: rekonsiliasiBank.omzetSistem,
      saldoAktual: rekonsiliasiBank.saldoAktual,
      selisih: rekonsiliasiBank.selisih,
      catatan: rekonsiliasiBank.catatan,
      verifiedAt: rekonsiliasiBank.verifiedAt,
      verifiedByName: userTable.name,
    })
    .from(rekonsiliasiBank)
    .leftJoin(userTable, eq(rekonsiliasiBank.verifiedBy, userTable.id))
    .where(
      and(
        gte(rekonsiliasiBank.tanggal, startRange),
        lte(rekonsiliasiBank.tanggal, endRange),
      ),
    )
    .orderBy(desc(rekonsiliasiBank.tanggal));

  // Merge: bikin map { "YYYY-MM-DD": { transfer: {...}, qris: {...} } }
  type HariMetode = {
    omzetSistem: number;
    rekon: {
      id: number;
      saldoAktual: number;
      selisih: number;
      catatan: string | null;
      verifiedAt: string;
      verifiedByName: string | null;
    } | null;
  };
  const hariMap = new Map<string, { transfer: HariMetode; qris: HariMetode }>();

  // Isi omzet sistem dari POS
  for (const r of posRows) {
    if (!hariMap.has(r.hari)) {
      hariMap.set(r.hari, {
        transfer: { omzetSistem: 0, rekon: null },
        qris: { omzetSistem: 0, rekon: null },
      });
    }
    const bucket = hariMap.get(r.hari)!;
    if (r.metode === "transfer") bucket.transfer.omzetSistem += Number(r.total);
    if (r.metode === "qris") bucket.qris.omzetSistem += Number(r.total);
  }

  // Tambah omzet order (transfer + dana → transfer bucket, qris → qris bucket)
  for (const r of orderRows) {
    if (!hariMap.has(r.hari)) {
      hariMap.set(r.hari, {
        transfer: { omzetSistem: 0, rekon: null },
        qris: { omzetSistem: 0, rekon: null },
      });
    }
    const bucket = hariMap.get(r.hari)!;
    if (r.metode === "transfer" || r.metode === "dana") {
      bucket.transfer.omzetSistem += Number(r.total);
    }
    if (r.metode === "qris") {
      bucket.qris.omzetSistem += Number(r.total);
    }
  }

  // Isi rekon existing
  for (const r of rekonRows) {
    const hariStr = r.tanggal.toISOString().slice(0, 10);
    if (!hariMap.has(hariStr)) {
      hariMap.set(hariStr, {
        transfer: { omzetSistem: 0, rekon: null },
        qris: { omzetSistem: 0, rekon: null },
      });
    }
    const bucket = hariMap.get(hariStr)!;
    const rekonData = {
      id: r.id,
      saldoAktual: r.saldoAktual,
      selisih: r.selisih,
      catatan: r.catatan,
      verifiedAt: r.verifiedAt.toISOString(),
      verifiedByName: r.verifiedByName,
    };
    if (r.metode === "transfer") bucket.transfer.rekon = rekonData;
    if (r.metode === "qris") bucket.qris.rekon = rekonData;
  }

  // Sortir desc by tanggal
  const hariList = Array.from(hariMap.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .filter(
      ([, v]) =>
        v.transfer.omzetSistem > 0 ||
        v.qris.omzetSistem > 0 ||
        v.transfer.rekon !== null ||
        v.qris.rekon !== null,
    )
    .map(([tanggal, v]) => ({ tanggal, ...v }));

  // Ringkasan
  const totalHari = hariList.length;
  const totalVerified = hariList.filter(
    (h) =>
      (h.transfer.omzetSistem === 0 || h.transfer.rekon !== null) &&
      (h.qris.omzetSistem === 0 || h.qris.rekon !== null),
  ).length;
  const totalSelisih = rekonRows.reduce((s, r) => s + r.selisih, 0);
  const belumVerified = totalHari - totalVerified;

  return (
    <div className="p-4 md:p-6 max-w-5xl space-y-4">
      <PageHeader
        title="Rekonsiliasi Bank & QRIS"
        description={`Cocokkan omzet transfer & QRIS di sistem vs saldo aktual yang masuk ke rekening / merchant. Tampilkan ${hariCount} hari terakhir.`}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
        <SumCard label="HARI DENGAN AKTIVITAS" value={String(totalHari)} />
        <SumCard
          label="SUDAH DIVERIFIKASI"
          value={`${totalVerified}/${totalHari}`}
          color={totalVerified === totalHari ? "emerald" : "amber"}
        />
        <SumCard label="BELUM DIVERIFIKASI" value={String(belumVerified)} color={belumVerified > 0 ? "amber" : "emerald"} />
        <SumCard
          label="TOTAL SELISIH"
          value={
            (totalSelisih > 0 ? "+" : "") +
            totalSelisih.toLocaleString("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 })
          }
          color={totalSelisih === 0 ? "emerald" : totalSelisih > 0 ? "blue" : "rose"}
        />
      </div>

      {/* Filter hari */}
      <form className="flex items-center gap-2 text-sm">
        <label className="text-[color:var(--muted)]">Tampilkan:</label>
        <select
          name="hari"
          defaultValue={String(hariCount)}
          className="px-2 py-1.5 border border-line rounded-md bg-surface"
        >
          <option value="7">7 hari</option>
          <option value="14">14 hari</option>
          <option value="30">30 hari</option>
          <option value="60">60 hari</option>
          <option value="90">90 hari</option>
        </select>
        <button
          type="submit"
          className="px-3 py-1.5 bg-brand text-white rounded-md text-xs font-bold"
        >
          Terapkan
        </button>
      </form>

      <RekonsiliasiClient hariList={hariList} />

      <div className="bg-[color:var(--surface2)] rounded-xl p-3 text-[11px] text-[color:var(--muted)] leading-relaxed">
        <b>Cara pakai:</b> buka mobile banking / QRIS merchant Anda, lihat total
        saldo yang masuk hari tertentu, lalu input di kolom &quot;Saldo Aktual&quot;.
        Sistem akan otomatis hitung selisih. Kalau selisih != 0, wajib beri
        catatan penjelasan (biaya transfer, salah kasir tandai lunas, dll).
        <br />
        <br />
        <b>Cash tidak muncul di sini</b> — cash direkonsiliasi otomatis lewat
        Shift Kasir (uang fisik vs expected).
      </div>
    </div>
  );
}

function SumCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: "emerald" | "amber" | "rose" | "blue";
}) {
  const colorMap = {
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-700",
    amber: "bg-amber-50 border-amber-200 text-amber-700",
    rose: "bg-rose-50 border-rose-200 text-rose-700",
    blue: "bg-blue-50 border-blue-200 text-blue-700",
  };
  const cls = color ? colorMap[color] : "bg-surface border-line";
  return (
    <div className={`rounded-xl border px-2 py-2 md:px-3 min-w-0 ${cls}`}>
      <div className="text-[10px] tracking-widest font-bold opacity-80 truncate">
        {label}
      </div>
      <div className="text-sm md:text-base font-extrabold mt-0.5 tabular-nums truncate">
        {value}
      </div>
    </div>
  );
}
