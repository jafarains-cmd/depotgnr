import Link from "next/link";
import { db } from "@/db";
import { eq, desc, and, gte, lte, like, or, sql, isNull, isNotNull } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { TransaksiRow } from "./TransaksiRow";
import { transaksi } from "@/db/schema/transaksi";
import { user as userTable } from "@/db/schema/auth";
import { pelanggan } from "@/db/schema/pelanggan";
import { orderHeader } from "@/db/schema/order";
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
    sumber?: string;
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
  const sumber = (["semua", "pos", "antar"] as const).includes(
    sp.sumber as never,
  )
    ? (sp.sumber as "semua" | "pos" | "antar")
    : "semua";

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

  // Filter sumber: pos = tidak ada refOrderId (POS langsung),
  //                antar = ada refOrderId (hasil sync order antar)
  if (sumber === "pos") conds.push(isNull(transaksi.refOrderId));
  else if (sumber === "antar") conds.push(isNotNull(transaksi.refOrderId));

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

  // Count per sumber (pakai tab status yang aktif juga supaya konsisten
  // sama dengan filter yang user lihat)
  const sumberBase = [...conds.filter((c) => c !== undefined)];
  // Buang filter sumber dari sumberBase supaya count menghitung total
  // yang bisa difilter oleh tab sumber, bukan hasil filter sumber saat ini
  const sumberBaseWhere = (() => {
    const c = [...baseConds];
    if (q) {
      const pat = `%${q}%`;
      c.push(
        or(
          like(pelanggan.nama, pat),
          like(pelanggan.telp, pat),
          like(transaksi.nomorNota, pat),
        )!,
      );
    }
    if (tab === "aktif") c.push(isNull(transaksi.voidedAt));
    else if (tab === "batal") c.push(isNotNull(transaksi.voidedAt));
    return c.length > 0 ? and(...c) : undefined;
  })();

  const [posCnt] = await db
    .select({ n: sql<number>`count(*)` })
    .from(transaksi)
    .leftJoin(pelanggan, eq(transaksi.pelangganId, pelanggan.id))
    .where(and(sumberBaseWhere, isNull(transaksi.refOrderId)));
  const [antarCnt] = await db
    .select({ n: sql<number>`count(*)` })
    .from(transaksi)
    .leftJoin(pelanggan, eq(transaksi.pelangganId, pelanggan.id))
    .where(and(sumberBaseWhere, isNotNull(transaksi.refOrderId)));
  const [sumberSemuaCnt] = await db
    .select({ n: sql<number>`count(*)` })
    .from(transaksi)
    .leftJoin(pelanggan, eq(transaksi.pelangganId, pelanggan.id))
    .where(sumberBaseWhere);

  // Alias user table untuk join kurir (dari orderHeader) supaya tidak
  // konflik dengan alias kasir.
  const kurirUser = alias(userTable, "kurir_user");

  const rows = await db
    .select({
      id: transaksi.id,
      nomorNota: transaksi.nomorNota,
      total: transaksi.total,
      metodeBayar: transaksi.metodeBayar,
      createdAt: transaksi.createdAt,
      voidedAt: transaksi.voidedAt,
      kasir: userTable.name,
      kasirRole: userTable.role,
      pelangganNama: pelanggan.nama,
      refOrderId: transaksi.refOrderId,
      alamatAntar: orderHeader.alamatAntar,
      kurirNama: kurirUser.name,
    })
    .from(transaksi)
    .leftJoin(userTable, eq(transaksi.kasirUserId, userTable.id))
    .leftJoin(pelanggan, eq(transaksi.pelangganId, pelanggan.id))
    .leftJoin(orderHeader, eq(transaksi.refOrderId, orderHeader.id))
    .leftJoin(kurirUser, eq(orderHeader.kurirUserId, kurirUser.id))
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
            if (sumber !== "semua") params.set("sumber", sumber);
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

        {/* Tab sumber: Semua Sumber / POS Depot / Order Antar */}
        <div className="flex gap-1 text-xs">
          {(
            [
              {
                key: "semua",
                label: "Semua Sumber",
                icon: "",
                count: sumberSemuaCnt?.n ?? 0,
                color: "brand",
              },
              {
                key: "pos",
                label: "POS Depot",
                icon: "🏪",
                count: posCnt?.n ?? 0,
                color: "sky",
              },
              {
                key: "antar",
                label: "Order Antar",
                icon: "🚛",
                count: antarCnt?.n ?? 0,
                color: "amber",
              },
            ] as const
          ).map((s) => {
            const params = new URLSearchParams();
            if (s.key !== "semua") params.set("sumber", s.key);
            if (tab !== "aktif") params.set("tab", tab);
            if (range.key) params.set("range", range.key);
            if (sp.from) params.set("from", sp.from);
            if (sp.to) params.set("to", sp.to);
            if (q) params.set("q", q);
            const isActive = sumber === s.key;
            const activeClass =
              s.color === "sky"
                ? "bg-sky-600 text-white"
                : s.color === "amber"
                  ? "bg-amber-600 text-white"
                  : "bg-brand-600 text-white";
            return (
              <Link
                key={s.key}
                href={`/kasir/transaksi${params.toString() ? `?${params}` : ""}`}
                className={`px-3 py-1.5 rounded-md font-bold inline-flex items-center gap-1.5 ${
                  isActive
                    ? activeClass
                    : "bg-[color:var(--surface2)] text-[color:var(--muted)] hover:text-ink"
                }`}
              >
                {s.icon && <span>{s.icon}</span>}
                {s.label}
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-extrabold ${
                    isActive ? "bg-white/30" : "bg-[color:var(--surface)] text-ink"
                  }`}
                >
                  {s.count}
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
          {sumber !== "semua" && <input type="hidden" name="sumber" value={sumber} />}
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
                <th className="p-3 hidden lg:table-cell">Sumber</th>
                <th className="p-3 hidden md:table-cell">Kasir/Kurir</th>
                <th className="p-3 hidden sm:table-cell">Bayar</th>
                <th className="p-3 text-right">Total</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => {
                const isAntar = r.refOrderId !== null;
                const isWalkinDepot =
                  isAntar && r.alamatAntar === "(diambil di depot)";
                const displaySumberLabel = isAntar
                  ? isWalkinDepot
                    ? "🏪 POS DEPOT"
                    : "🚛 ANTAR"
                  : "🏪 POS DEPOT";
                const sumberBadgeClass = isAntar && !isWalkinDepot
                  ? "bg-amber-100 text-amber-800 border-amber-200"
                  : "bg-sky-100 text-sky-800 border-sky-200";
                const displayNama = isAntar ? r.kurirNama ?? "—" : r.kasir ?? "—";
                const displayRole = isAntar && !isWalkinDepot ? "KURIR" : "KASIR";
                return (
                  <TransaksiRow key={r.id} trxId={r.id}>
                    <td className="p-3 text-xs text-[color:var(--muted)]">
                      {r.createdAt.toLocaleString("id-ID", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {/* di mobile, tampilkan info nota, sumber & metode bayar di bawah waktu */}
                      <div className="sm:hidden text-[10px] mt-0.5 font-mono">{r.nomorNota}</div>
                      <div className="lg:hidden text-[10px] mt-0.5">
                        <span className={`inline-block px-1 py-0.5 rounded text-[9px] font-bold border ${sumberBadgeClass}`}>
                          {displaySumberLabel}
                        </span>
                      </div>
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
                    <td className="p-3 truncate max-w-[140px]">
                      {r.pelangganNama ?? (
                        <span className="text-[color:var(--muted)]">walk-in</span>
                      )}
                      {isAntar && !isWalkinDepot && r.alamatAntar && (
                        <div className="text-[10px] text-[color:var(--muted)] truncate mt-0.5" title={r.alamatAntar}>
                          📍 {r.alamatAntar}
                        </div>
                      )}
                    </td>
                    <td className="p-3 hidden lg:table-cell">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${sumberBadgeClass}`}>
                        {displaySumberLabel}
                      </span>
                    </td>
                    <td className="p-3 hidden md:table-cell">
                      <div className="text-sm">{displayNama}</div>
                      <div className="text-[9px] font-bold text-[color:var(--muted)] uppercase tracking-wider">
                        {displayRole}
                      </div>
                    </td>
                    <td className="p-3 uppercase text-xs hidden sm:table-cell">{r.metodeBayar}</td>
                    <td className={`p-3 text-right font-medium whitespace-nowrap ${r.voidedAt ? "line-through text-[color:var(--muted)]" : ""}`}>
                      {formatRupiah(r.total)}
                    </td>
                    <td className="p-3 text-right">
                      <span className="text-xs text-brand">Detail →</span>
                    </td>
                  </TransaksiRow>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-[color:var(--muted)]">
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
