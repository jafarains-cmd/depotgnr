import { sql, gte, lte, and, eq, desc, like, or, inArray } from "drizzle-orm";
import { db } from "@/db";
import { pengeluaran } from "@/db/schema/pengeluaran";
import { user as userTable } from "@/db/schema/auth";
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
import { AutoSubmitSelect } from "../AutoSubmitSelect";

export const dynamic = "force-dynamic";

export default async function PengeluaranReportPage({
  searchParams,
}: {
  searchParams: Promise<{
    range?: string;
    from?: string;
    to?: string;
    q?: string;
    userId?: string;
    kategori?: string;
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
  const userId = sp.userId?.trim() || undefined;
  const kategori = sp.kategori?.trim() || undefined;

  const conds = [];
  if (range.from) conds.push(gte(pengeluaran.tanggal, range.from));
  if (range.to) conds.push(lte(pengeluaran.tanggal, range.to));
  if (userId) conds.push(eq(pengeluaran.createdBy, userId));
  if (kategori && kategori !== "all") conds.push(eq(pengeluaran.kategori, kategori));
  if (q) {
    const pat = `%${q}%`;
    conds.push(or(like(pengeluaran.deskripsi, pat), like(pengeluaran.kategori, pat))!);
  }
  const where = conds.length ? and(...conds) : undefined;

  const [countRow] = await db
    .select({ n: sql<number>`count(*)` })
    .from(pengeluaran)
    .where(where);
  const total = countRow?.n ?? 0;
  const { page, totalPages, offset } = getPagination({ total, limit, page: pageParam });

  const [summary] = await db
    .select({
      jumlahTotal: sql<number>`coalesce(sum(${pengeluaran.jumlah}), 0)`,
    })
    .from(pengeluaran)
    .where(where);

  const rows = await db
    .select({
      id: pengeluaran.id,
      tanggal: pengeluaran.tanggal,
      kategori: pengeluaran.kategori,
      jumlah: pengeluaran.jumlah,
      deskripsi: pengeluaran.deskripsi,
      createdByName: userTable.name,
    })
    .from(pengeluaran)
    .leftJoin(userTable, eq(pengeluaran.createdBy, userTable.id))
    .where(where)
    .orderBy(desc(pengeluaran.tanggal))
    .limit(limit)
    .offset(offset);

  const [userList, kategoriRows] = await Promise.all([
    db
      .select({ id: userTable.id, name: userTable.name })
      .from(userTable)
      .where(inArray(userTable.role, ["admin", "kasir"])),
    db
      .selectDistinct({ kategori: pengeluaran.kategori })
      .from(pengeluaran)
      .orderBy(pengeluaran.kategori),
  ]);
  const kategoriList = kategoriRows.map((r) => r.kategori);

  const fromStr = range.from?.toISOString().slice(0, 10) ?? "";
  const toStr = range.to?.toISOString().slice(0, 10) ?? "";

  return (
    <div className="p-4 md:p-6 space-y-4 laporan-print">
      <PrintStyles />
      <div className="no-print">
        <PageHeader title="Laporan Pengeluaran" description="Rincian pengeluaran operasional." />
      </div>
      <LaporanNav active="/admin/laporan/pengeluaran" />

      <PrintHeader title="LAPORAN PENGELUARAN" fromStr={fromStr} toStr={toStr} />

      <FilterBar
        basePath="/admin/laporan/pengeluaran"
        rangeKey={range.key}
        rangeFrom={range.from}
        rangeTo={range.to}
        q={q}
        userId={userId}
        userList={userList}
        userLabel="Pencatat"
        extraHidden={{ kategori }}
      />

      <form className="flex gap-2 items-center text-xs no-print">
        {range.key && range.key !== "30d" && <input type="hidden" name="range" value={range.key} />}
        {q && <input type="hidden" name="q" value={q} />}
        {userId && <input type="hidden" name="userId" value={userId} />}
        <AutoSubmitSelect
          name="kategori"
          value={kategori ?? "all"}
          label="Kategori:"
          options={[
            { value: "all", label: "Semua" },
            ...kategoriList.map((k) => ({ value: k, label: k.replace(/-/g, " ") })),
          ]}
        />
      </form>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="grid grid-cols-2 gap-2 text-sm flex-1 min-w-0">
          <SumCard label="Entri" value={String(total)} />
          <SumCard label="Total Pengeluaran" value={formatRupiah(summary.jumlahTotal)} highlight />
        </div>
        <PageSizeSelect value={limit} />
      </div>

      <ExportActions
        jenis="pengeluaran"
        params={{
          range: range.key,
          from: fromStr,
          to: toStr,
          q,
          userId,
          kategori,
        }}
      />

      <div className="bg-surface border border-line rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-[color:var(--surface2)] text-[color:var(--muted)] text-left">
              <tr>
                <th className="p-2">Tanggal</th>
                <th className="p-2">Kategori</th>
                <th className="p-2">Deskripsi</th>
                <th className="p-2">Dicatat oleh</th>
                <th className="p-2 text-right">Jumlah</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="p-2 whitespace-nowrap">
                    {r.tanggal.toLocaleDateString("id-ID", {
                      day: "2-digit",
                      month: "short",
                      year: "2-digit",
                    })}
                  </td>
                  <td className="p-2 capitalize">{r.kategori.replace(/-/g, " ")}</td>
                  <td className="p-2 max-w-[300px] truncate" title={r.deskripsi ?? ""}>
                    {r.deskripsi ?? "-"}
                  </td>
                  <td className="p-2">{r.createdByName ?? "-"}</td>
                  <td className="p-2 text-right font-bold text-rose-700">
                    {formatRupiah(r.jumlah)}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-[color:var(--muted)]">
                    Tidak ada pengeluaran pada filter ini.
                  </td>
                </tr>
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot className="bg-[color:var(--surface2)] font-bold">
                <tr>
                  <td colSpan={4} className="p-2 text-right">
                    TOTAL halaman ini:
                  </td>
                  <td className="p-2 text-right text-rose-700">
                    {formatRupiah(rows.reduce((s, r) => s + r.jumlah, 0))}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <Pagination page={page} totalPages={totalPages} total={total} />
    </div>
  );
}

function SumCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className={`rounded-xl border border-line px-3 py-2 ${
        highlight ? "bg-rose-50 text-rose-700" : "bg-surface"
      }`}
    >
      <div className="text-[10px] tracking-widest font-bold text-[color:var(--muted)]">
        {label}
      </div>
      <div className="text-base font-extrabold mt-0.5">{value}</div>
    </div>
  );
}
