import { sql, gte, lte, and, eq, desc, isNull, like, or, inArray } from "drizzle-orm";
import { db } from "@/db";
import { transaksi, transaksiItem } from "@/db/schema/transaksi";
import { user as userTable } from "@/db/schema/auth";
import { pelanggan as pelangganTable } from "@/db/schema/pelanggan";
import { produk } from "@/db/schema/produk";
import { PageHeader } from "@/components/AppShell";
import { requireRole } from "@/lib/permissions";
import { formatRupiah } from "@/lib/utils";
import { parseRange } from "@/lib/date-range";
import { parseLimit, parsePage, getPagination } from "@/lib/page-size";
import { PageSizeSelect } from "@/components/PageSizeSelect";
import { Pagination } from "@/components/Pagination";
import { LaporanNav } from "../LaporanNav";
import { FilterBar } from "../FilterBar";
import { ExportActions } from "../ExportActions";
import { PrintStyles, PrintHeader } from "../PrintStyles";
import { LaporanClickProvider, LaporanRow, LaporanCard } from "../LaporanClickable";

export const dynamic = "force-dynamic";

export default async function PenjualanReportPage({
  searchParams,
}: {
  searchParams: Promise<{
    range?: string;
    from?: string;
    to?: string;
    q?: string;
    userId?: string;
    pelangganId?: string;
    limit?: string;
    page?: string;
  }>;
}) {
  await requireRole(["admin"]);
  const sp = await searchParams;
  const range = parseRange(sp);
  const limit = parseLimit(sp.limit);
  const pageParam = parsePage(sp.page);
  const q = (sp.q ?? "").trim();
  const kasirId = sp.userId?.trim() || undefined;
  const pelangganId = sp.pelangganId?.trim() || undefined;

  const conds = [isNull(transaksi.voidedAt)];
  if (range.from) conds.push(gte(transaksi.createdAt, range.from));
  if (range.to) conds.push(lte(transaksi.createdAt, range.to));
  if (kasirId) conds.push(eq(transaksi.kasirUserId, kasirId));
  if (pelangganId) conds.push(eq(transaksi.pelangganId, Number(pelangganId)));
  if (q) {
    const pat = `%${q}%`;
    conds.push(
      or(
        like(transaksi.nomorNota, pat),
        like(pelangganTable.nama, pat),
        like(transaksi.catatan, pat),
      )!,
    );
  }
  const where = and(...conds);

  const [countRow] = await db
    .select({ n: sql<number>`count(*)` })
    .from(transaksi)
    .leftJoin(pelangganTable, eq(transaksi.pelangganId, pelangganTable.id))
    .where(where);
  const total = countRow?.n ?? 0;
  const { page, totalPages, offset } = getPagination({ total, limit, page: pageParam });

  // Summary
  const [summary] = await db
    .select({
      omzet: sql<number>`coalesce(sum(${transaksi.total}), 0)`,
      diskon: sql<number>`coalesce(sum(${transaksi.diskon}), 0)`,
    })
    .from(transaksi)
    .leftJoin(pelangganTable, eq(transaksi.pelangganId, pelangganTable.id))
    .where(where);

  const rows = await db
    .select({
      id: transaksi.id,
      nomorNota: transaksi.nomorNota,
      createdAt: transaksi.createdAt,
      total: transaksi.total,
      diskon: transaksi.diskon,
      subtotal: transaksi.subtotal,
      metodeBayar: transaksi.metodeBayar,
      status: transaksi.status,
      catatan: transaksi.catatan,
      kasirNama: userTable.name,
      pelangganNama: pelangganTable.nama,
    })
    .from(transaksi)
    .leftJoin(userTable, eq(transaksi.kasirUserId, userTable.id))
    .leftJoin(pelangganTable, eq(transaksi.pelangganId, pelangganTable.id))
    .where(where)
    .orderBy(desc(transaksi.createdAt))
    .limit(limit)
    .offset(offset);

  // Items per transaksi (untuk kolom "Items")
  const ids = rows.map((r) => r.id);
  const itemMap = new Map<number, { nama: string; qty: number; jenis: string }[]>();
  if (ids.length) {
    const items = await db
      .select({
        transaksiId: transaksiItem.transaksiId,
        qty: transaksiItem.qty,
        jenis: transaksiItem.jenis,
        nama: produk.nama,
      })
      .from(transaksiItem)
      .leftJoin(produk, eq(transaksiItem.produkId, produk.id))
      .where(inArray(transaksiItem.transaksiId, ids));
    for (const it of items) {
      const arr = itemMap.get(it.transaksiId) ?? [];
      arr.push({ nama: it.nama ?? "-", qty: it.qty, jenis: it.jenis });
      itemMap.set(it.transaksiId, arr);
    }
  }

  // Daftar kasir + pelanggan untuk dropdown filter
  const [kasirList, pelangganListAll] = await Promise.all([
    db
      .select({ id: userTable.id, name: userTable.name })
      .from(userTable)
      .where(inArray(userTable.role, ["admin", "kasir"])),
    db
      .select({ id: pelangganTable.id, nama: pelangganTable.nama })
      .from(pelangganTable)
      .orderBy(pelangganTable.nama)
      .limit(500),
  ]);

  const fromStr = range.from?.toISOString().slice(0, 10) ?? "";
  const toStr = range.to?.toISOString().slice(0, 10) ?? "";

  return (
    <div className="p-4 md:p-6 space-y-4 laporan-print">
      <PrintStyles />

      <div className="no-print">
        <PageHeader title="Laporan Penjualan" description="Rincian transaksi penjualan per nota." />
      </div>
      <LaporanNav active="/admin/laporan/penjualan" />

      <PrintHeader
        title="LAPORAN PENJUALAN"
        fromStr={fromStr}
        toStr={toStr}
        extra={kasirId ? `Kasir: ${kasirList.find((k) => k.id === kasirId)?.name ?? "-"}` : undefined}
      />

      <FilterBar
        basePath="/admin/laporan/penjualan"
        rangeKey={range.key}
        rangeFrom={range.from}
        rangeTo={range.to}
        q={q}
        userId={kasirId}
        userList={kasirList}
        userLabel="Kasir"
        pelangganId={pelangganId}
        pelangganList={pelangganListAll}
        showPelanggan
      />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="grid grid-cols-3 gap-2 text-sm flex-1 min-w-0">
          <SumCard label="Transaksi" value={String(total)} />
          <SumCard label="Omzet" value={formatRupiah(summary.omzet)} highlight />
          <SumCard label="Diskon" value={formatRupiah(summary.diskon)} />
        </div>
        <PageSizeSelect value={limit} />
      </div>

      <ExportActions
        jenis="penjualan"
        params={{
          range: range.key,
          from: fromStr,
          to: toStr,
          q,
          userId: kasirId,
          pelangganId,
        }}
      />

      <div className="bg-surface border border-line rounded-2xl overflow-hidden">
        <LaporanClickProvider>
          {/* Desktop: table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-[color:var(--surface2)] text-[color:var(--muted)] text-left">
                <tr>
                  <th className="p-2">Tanggal</th>
                  <th className="p-2">No. Nota</th>
                  <th className="p-2">Kasir</th>
                  <th className="p-2">Pelanggan</th>
                  <th className="p-2">Items</th>
                  <th className="p-2 text-right">Qty</th>
                  <th className="p-2 text-right">Subtotal</th>
                  <th className="p-2 text-right">Diskon</th>
                  <th className="p-2 text-right">Total</th>
                  <th className="p-2">Bayar</th>
                  <th className="p-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => {
                  const its = itemMap.get(r.id) ?? [];
                  const qtyTotal = its.reduce((s, it) => s + it.qty, 0);
                  const itemsStr = its
                    .map((it) => `${it.nama} (${it.qty} ${it.jenis})`)
                    .join(", ");
                  return (
                    <LaporanRow key={r.id} target={{ kind: "transaksi", id: r.id }}>
                      <td className="p-2 whitespace-nowrap">
                        {r.createdAt.toLocaleString("id-ID", {
                          day: "2-digit",
                          month: "short",
                          year: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="p-2 font-mono">{r.nomorNota}</td>
                      <td className="p-2">{r.kasirNama ?? "-"}</td>
                      <td className="p-2">{r.pelangganNama ?? "—"}</td>
                      <td className="p-2 max-w-[260px] truncate" title={itemsStr}>
                        {itemsStr || "-"}
                      </td>
                      <td className="p-2 text-right">{qtyTotal}</td>
                      <td className="p-2 text-right">{formatRupiah(r.subtotal)}</td>
                      <td className="p-2 text-right">{formatRupiah(r.diskon)}</td>
                      <td className="p-2 text-right font-bold">{formatRupiah(r.total)}</td>
                      <td className="p-2 uppercase">{r.metodeBayar}</td>
                      <td className="p-2 uppercase">{r.status}</td>
                    </LaporanRow>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={11} className="p-8 text-center text-[color:var(--muted)]">
                      Tidak ada transaksi pada filter ini.
                    </td>
                  </tr>
                )}
              </tbody>
              {rows.length > 0 && (
                <tfoot className="bg-[color:var(--surface2)] font-bold">
                  <tr>
                    <td colSpan={8} className="p-2 text-right">
                      TOTAL halaman ini:
                    </td>
                    <td className="p-2 text-right text-brand">
                      {formatRupiah(rows.reduce((s, r) => s + r.total, 0))}
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Mobile: card list */}
          <div className="md:hidden divide-y divide-line">
            {rows.map((r) => {
              const its = itemMap.get(r.id) ?? [];
              const qtyTotal = its.reduce((s, it) => s + it.qty, 0);
              const itemsStr = its
                .map((it) => `${it.nama} (${it.qty} ${it.jenis})`)
                .join(", ");
              return (
                <LaporanCard key={`m-${r.id}`} target={{ kind: "transaksi", id: r.id }}>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="text-[11px] text-[color:var(--muted)] font-mono truncate">
                      {r.nomorNota}
                    </div>
                    <div className="font-extrabold text-sm shrink-0">
                      {formatRupiah(r.total)}
                    </div>
                  </div>
                  <div className="text-sm font-bold truncate">
                    {r.pelangganNama ?? "—"}
                  </div>
                  <div className="text-[11px] text-[color:var(--muted)] mt-0.5 line-clamp-2">
                    {itemsStr || "-"}
                  </div>
                  {r.diskon > 0 && (
                    <div className="text-[11px] text-amber-700 mt-0.5">
                      Diskon: {formatRupiah(r.diskon)} · Subtotal {formatRupiah(r.subtotal)}
                    </div>
                  )}
                  <div className="flex items-center justify-between text-[11px] text-[color:var(--muted)] mt-1 gap-2">
                    <span className="truncate">
                      {r.createdAt.toLocaleString("id-ID", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {r.kasirNama && ` · ${r.kasirNama}`}
                    </span>
                    <span className="shrink-0">
                      {qtyTotal} qty · {r.metodeBayar?.toUpperCase()}
                    </span>
                  </div>
                </LaporanCard>
              );
            })}
            {rows.length === 0 && (
              <div className="p-8 text-center text-[color:var(--muted)] text-sm">
                Tidak ada transaksi pada filter ini.
              </div>
            )}
            {rows.length > 0 && (
              <div className="bg-[color:var(--surface2)] p-3 flex justify-between font-bold text-sm">
                <span>TOTAL halaman ini:</span>
                <span className="text-brand">
                  {formatRupiah(rows.reduce((s, r) => s + r.total, 0))}
                </span>
              </div>
            )}
          </div>
        </LaporanClickProvider>
      </div>

      <Pagination page={page} totalPages={totalPages} total={total} />
    </div>
  );
}

function SumCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className={`rounded-xl border border-line px-3 py-2 ${
        highlight ? "bg-emerald-50 text-emerald-700" : "bg-surface"
      }`}
    >
      <div className="text-[10px] tracking-widest font-bold text-[color:var(--muted)]">
        {label}
      </div>
      <div className="text-base font-extrabold mt-0.5">{value}</div>
    </div>
  );
}
