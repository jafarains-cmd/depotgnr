import Link from "next/link";
import { db } from "@/db";
import { eq, desc, and, gte, lte, like, or, sql, isNull, isNotNull } from "drizzle-orm";
import { TransaksiRow } from "./TransaksiRow";
import { transaksi } from "@/db/schema/transaksi";
import { user as userTable } from "@/db/schema/auth";
import { pelanggan } from "@/db/schema/pelanggan";
import { PageHeader } from "@/components/AppShell";
import { formatRupiah } from "@/lib/utils";
import { requireRole } from "@/lib/permissions";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { parseRange } from "@/lib/date-range";
import { PageSizeSelect } from "@/components/PageSizeSelect";
import { Pagination } from "@/components/Pagination";
import { parseLimit, parsePage, getPagination } from "@/lib/page-size";

export const dynamic = "force-dynamic";

export default async function RiwayatKasirPage({
  searchParams,
}: {
  searchParams: Promise<{
    range?: string;
    from?: string;
    to?: string;
    q?: string;
    limit?: string;
    page?: string;
    tab?: string;
  }>;
}) {
  const session = await requireRole(["admin", "kasir"]);
  const role = session.user.role;
  const sp = await searchParams;
  const range = parseRange(sp);
  const q = (sp.q ?? "").trim();
  const limit = parseLimit(sp.limit);
  const pageParam = parsePage(sp.page);
  const tab = (["aktif", "batal", "semua"] as const).includes(sp.tab as never)
    ? (sp.tab as "aktif" | "batal" | "semua")
    : "aktif";

  // baseConds = filter tanpa tab status; tabConds = base + filter status
  const baseConds = [];
  if (role !== "admin") baseConds.push(eq(transaksi.kasirUserId, session.user.id));
  if (range.from) baseConds.push(gte(transaksi.createdAt, range.from));
  if (range.to) baseConds.push(lte(transaksi.createdAt, range.to));

  const conds = [...baseConds];
  if (q) {
    const pat = `%${q}%`;
    conds.push(
      or(
        like(pelanggan.nama, pat),
        like(pelanggan.telp, pat),
        like(transaksi.nomorNota, pat),
      )!,
    );
  }
  if (tab === "aktif") conds.push(isNull(transaksi.voidedAt));
  else if (tab === "batal") conds.push(isNotNull(transaksi.voidedAt));

  const whereClause = conds.length > 0 ? and(...conds) : undefined;

  // Total count + sum omzet (exclude voided) untuk filter saat ini
  const [aggRow] = await db
    .select({
      n: sql<number>`count(*)`,
      omzet: sql<number>`coalesce(sum(case when ${transaksi.voidedAt} is null then ${transaksi.total} else 0 end), 0)`,
    })
    .from(transaksi)
    .leftJoin(pelanggan, eq(transaksi.pelangganId, pelanggan.id))
    .where(whereClause);
  const total = aggRow?.n ?? 0;
  const totalOmzet = aggRow?.omzet ?? 0;
  const { page, totalPages, offset } = getPagination({ total, limit, page: pageParam });

  // Count tiap tab — pakai baseConds + q saja, tanpa filter status
  const countConds = [...baseConds];
  if (q) {
    const pat = `%${q}%`;
    countConds.push(
      or(
        like(pelanggan.nama, pat),
        like(pelanggan.telp, pat),
        like(transaksi.nomorNota, pat),
      )!,
    );
  }
  const baseWhere = countConds.length > 0 ? and(...countConds) : undefined;
  const [aktifCnt] = await db
    .select({ n: sql<number>`count(*)` })
    .from(transaksi)
    .leftJoin(pelanggan, eq(transaksi.pelangganId, pelanggan.id))
    .where(and(baseWhere, isNull(transaksi.voidedAt)));
  const [batalCnt] = await db
    .select({ n: sql<number>`count(*)` })
    .from(transaksi)
    .leftJoin(pelanggan, eq(transaksi.pelangganId, pelanggan.id))
    .where(and(baseWhere, isNotNull(transaksi.voidedAt)));
  const [semuaCnt] = await db
    .select({ n: sql<number>`count(*)` })
    .from(transaksi)
    .leftJoin(pelanggan, eq(transaksi.pelangganId, pelanggan.id))
    .where(baseWhere);

  const rows = await db
    .select({
      id: transaksi.id,
      nomorNota: transaksi.nomorNota,
      total: transaksi.total,
      metodeBayar: transaksi.metodeBayar,
      createdAt: transaksi.createdAt,
      voidedAt: transaksi.voidedAt,
      kasir: userTable.name,
      pelangganNama: pelanggan.nama,
    })
    .from(transaksi)
    .leftJoin(userTable, eq(transaksi.kasirUserId, userTable.id))
    .leftJoin(pelanggan, eq(transaksi.pelangganId, pelanggan.id))
    .where(whereClause)
    .orderBy(desc(transaksi.createdAt))
    .limit(limit)
    .offset(offset);

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title="Riwayat Transaksi"
        description={role === "admin" ? "Semua transaksi." : "Transaksi yang Anda buat."}
      />
      <div className="mb-4 space-y-3">
        <DateRangeFilter
          active={range.key}
          customFrom={range.from}
          customTo={range.to}
          basePath="/kasir/transaksi"
        />
        {/* Tab status: Aktif / Dibatalkan / Semua */}
        <div className="flex gap-1 text-xs">
          {(
            [
              { key: "aktif", label: "Aktif", count: aktifCnt?.n ?? 0, color: "emerald" },
              { key: "batal", label: "Dibatalkan", count: batalCnt?.n ?? 0, color: "rose" },
              { key: "semua", label: "Semua", count: semuaCnt?.n ?? 0, color: "slate" },
            ] as const
          ).map((t) => {
            const params = new URLSearchParams();
            if (t.key !== "aktif") params.set("tab", t.key);
            if (range.key) params.set("range", range.key);
            if (sp.from) params.set("from", sp.from);
            if (sp.to) params.set("to", sp.to);
            if (q) params.set("q", q);
            const isActive = tab === t.key;
            return (
              <Link
                key={t.key}
                href={`/kasir/transaksi${params.toString() ? `?${params}` : ""}`}
                className={`px-3 py-1.5 rounded-md font-bold inline-flex items-center gap-1.5 ${
                  isActive
                    ? t.color === "emerald"
                      ? "bg-emerald-600 text-white"
                      : t.color === "rose"
                        ? "bg-rose-600 text-white"
                        : "bg-slate-700 text-white"
                    : "bg-[color:var(--surface2)] text-[color:var(--muted)] hover:text-ink"
                }`}
              >
                {t.label}
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-extrabold ${
                    isActive ? "bg-white/30" : "bg-[color:var(--surface)] text-ink"
                  }`}
                >
                  {t.count}
                </span>
              </Link>
            );
          })}
        </div>
        <form className="flex gap-2 items-center">
          {range.key && <input type="hidden" name="range" value={range.key} />}
          {sp.from && <input type="hidden" name="from" value={sp.from} />}
          {sp.to && <input type="hidden" name="to" value={sp.to} />}
          {tab !== "aktif" && <input type="hidden" name="tab" value={tab} />}
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Cari nama pelanggan / telp / no nota..."
            className="flex-1 px-3 py-2 border border-line rounded-md text-sm"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-brand-600 text-white rounded-md text-sm font-bold"
          >
            Cari
          </button>
          {q && (
            <Link
              href="/kasir/transaksi"
              className="px-3 py-2 text-sm text-[color:var(--muted)] hover:text-ink"
            >
              Reset
            </Link>
          )}
        </form>
      </div>
      <div className="mb-3 flex items-center justify-between flex-wrap gap-2 text-sm">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[color:var(--muted)]">{total} transaksi</span>
          <PageSizeSelect value={limit} />
        </div>
        <span className="font-bold text-brand">
          Omzet: {formatRupiah(totalOmzet)}
        </span>
      </div>
      <div className="bg-surface rounded-xl border border-line overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[color:var(--surface2)] text-[color:var(--muted)] text-left">
              <tr>
                <th className="p-3">Waktu</th>
                <th className="p-3 hidden sm:table-cell">No. Nota</th>
                <th className="p-3">Pelanggan</th>
                <th className="p-3 hidden md:table-cell">Kasir</th>
                <th className="p-3 hidden sm:table-cell">Bayar</th>
                <th className="p-3 text-right">Total</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <TransaksiRow key={r.id} trxId={r.id}>
                  <td className="p-3 text-xs text-[color:var(--muted)]">
                    {r.createdAt.toLocaleString("id-ID", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {/* di mobile, tampilkan info nota & metode bayar di bawah waktu */}
                    <div className="sm:hidden text-[10px] mt-0.5 font-mono">{r.nomorNota}</div>
                    <div className="sm:hidden text-[10px] mt-0.5 uppercase">{r.metodeBayar}</div>
                  </td>
                  <td className="p-3 font-mono text-xs hidden sm:table-cell">
                    {r.nomorNota}
                    {r.voidedAt && (
                      <span className="ml-1 text-[10px] px-1.5 py-0.5 bg-rose-600 text-white rounded font-extrabold tracking-wider">
                        ⊗ BATAL
                      </span>
                    )}
                  </td>
                  <td className="p-3 truncate max-w-[120px]">
                    {r.pelangganNama ?? (
                      <span className="text-[color:var(--muted)]">walk-in</span>
                    )}
                  </td>
                  <td className="p-3 hidden md:table-cell">{r.kasir ?? "-"}</td>
                  <td className="p-3 uppercase text-xs hidden sm:table-cell">{r.metodeBayar}</td>
                  <td className={`p-3 text-right font-medium whitespace-nowrap ${r.voidedAt ? "line-through text-[color:var(--muted)]" : ""}`}>
                    {formatRupiah(r.total)}
                  </td>
                  <td className="p-3 text-right">
                    <span className="text-xs text-brand">Detail →</span>
                  </td>
                </TransaksiRow>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-[color:var(--muted)]">
                    Belum ada transaksi.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <Pagination page={page} totalPages={totalPages} total={total} />
    </div>
  );
}
