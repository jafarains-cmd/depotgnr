import Link from "next/link";
import { Trophy, Users } from "lucide-react";
import { desc, gt, sql, inArray, eq, like, or, and } from "drizzle-orm";
import { db } from "@/db";
import { pelanggan as pelangganTable, galonPelanggan } from "@/db/schema/pelanggan";
import { orderHeader } from "@/db/schema/order";
import { user as userTable } from "@/db/schema/auth";
import { requireRole } from "@/lib/permissions";
import { formatRupiah } from "@/lib/utils";
import { PelangganTable } from "./PelangganTable";
import { PageSizeSelect } from "@/components/PageSizeSelect";
import { Pagination } from "@/components/Pagination";
import { parseLimit, parsePage, getPagination } from "@/lib/page-size";

export const dynamic = "force-dynamic";

const RANK_BG = ["bg-amber-400", "bg-slate-300", "bg-orange-400"];

type Tab = "data" | "top";

export default async function PelangganDataPage({
  searchParams,
}: {
  searchParams: Promise<{ limit?: string; page?: string; q?: string; tab?: string }>;
}) {
  const session = await requireRole(["admin", "kasir"]);
  const sp = await searchParams;
  const limit = parseLimit(sp.limit);
  const pageParam = parsePage(sp.page);
  const q = (sp.q ?? "").trim();
  const tab: Tab = sp.tab === "top" ? "top" : "data";

  // Filter pelanggan (server-side) — search berlaku untuk SELURUH data, bukan
  // hanya halaman aktif. Pagination dijalankan setelah filter.
  const whereClause = q
    ? or(
        like(pelangganTable.nama, `%${q}%`),
        like(pelangganTable.telp, `%${q}%`),
        like(pelangganTable.alamat, `%${q}%`),
      )
    : undefined;

  const [countRow] = await db
    .select({ n: sql<number>`count(*)` })
    .from(pelangganTable)
    .where(whereClause);
  const total = countRow?.n ?? 0;
  const { page, totalPages, offset } = getPagination({ total, limit, page: pageParam });

  // Tab "top" load list lebih banyak (top 50), tab "data" hanya top 10 sebagai preview
  const topLimit = tab === "top" ? 50 : 10;

  const [list, top, titipanTotals, topCountRow] = await Promise.all([
    db.query.pelanggan.findMany({
      where: whereClause,
      orderBy: (p, { desc }) => [desc(p.createdAt)],
      limit,
      offset,
    }),
    db
      .select({
        id: pelangganTable.id,
        nama: pelangganTable.nama,
        saldoLoyalti: pelangganTable.saldoLoyalti,
      })
      .from(pelangganTable)
      .where(gt(pelangganTable.saldoLoyalti, 0))
      .orderBy(desc(pelangganTable.saldoLoyalti))
      .limit(topLimit),
    db
      .select({
        pelangganId: galonPelanggan.pelangganId,
        total: sql<number>`coalesce(sum(${galonPelanggan.jumlahDititip}), 0)`,
      })
      .from(galonPelanggan)
      .groupBy(galonPelanggan.pelangganId),
    db
      .select({ n: sql<number>`count(*)` })
      .from(pelangganTable)
      .where(gt(pelangganTable.saldoLoyalti, 0)),
  ]);
  const topCount = topCountRow[0]?.n ?? 0;

  const titipanMap = new Map(titipanTotals.map((t) => [t.pelangganId, t.total]));

  // Total piutang per pelanggan untuk list — query terpisah supaya aggregate akurat
  const piutangPerPelanggan = await db
    .select({
      pelangganId: orderHeader.pelangganId,
      total: sql<number>`coalesce(sum(${orderHeader.totalEstimasi} - ${orderHeader.paidPartial}), 0)`,
    })
    .from(orderHeader)
    .where(
      and(
        eq(orderHeader.status, "selesai"),
        eq(orderHeader.statusBayar, "belum"),
      ),
    )
    .groupBy(orderHeader.pelangganId);
  const piutangMap = new Map(
    piutangPerPelanggan
      .filter((p) => p.pelangganId !== null)
      .map((p) => [p.pelangganId as number, Number(p.total)]),
  );

  // Linked users — ambil info user yang tertaut ke pelanggan di halaman ini
  const userIds = list.map((p) => p.userId).filter((id): id is string => !!id);
  const linkedUsers = userIds.length
    ? await db
        .select({
          id: userTable.id,
          name: userTable.name,
          email: userTable.email,
          username: userTable.username,
        })
        .from(userTable)
        .where(inArray(userTable.id, userIds))
    : [];
  const userMap = new Map(linkedUsers.map((u) => [u.id, u]));
  void eq;

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold">Data Pelanggan</h1>
          <p className="text-sm text-[color:var(--muted)]">
            Walk-in dan langganan. Klik nama untuk lihat detail saldo loyalty & history.
          </p>
        </div>
        {tab === "data" && <PageSizeSelect value={limit} />}
      </div>

      {/* Tab nav — scrollable di mobile */}
      <div className="mb-4 overflow-x-auto -mx-1 px-1">
        <div className="inline-flex gap-1.5 min-w-max">
          <Link
            href="/data-pelanggan"
            className={`px-3 py-1.5 rounded-md text-sm inline-flex items-center gap-1.5 whitespace-nowrap ${
              tab === "data"
                ? "bg-brand-600 text-white"
                : "bg-surface border border-line hover:border-brand"
            }`}
          >
            <Users size={14} /> Data Pelanggan
            <span
              className={`px-1.5 rounded-full text-[10px] font-bold ${
                tab === "data"
                  ? "bg-white/20"
                  : "bg-[color:var(--surface2)] text-[color:var(--muted)]"
              }`}
            >
              {total}
            </span>
          </Link>
          <Link
            href="/data-pelanggan?tab=top"
            className={`px-3 py-1.5 rounded-md text-sm inline-flex items-center gap-1.5 whitespace-nowrap ${
              tab === "top"
                ? "bg-brand-600 text-white"
                : "bg-surface border border-line hover:border-brand"
            }`}
          >
            <Trophy size={14} className={tab === "top" ? "" : "text-amber-500"} /> Top Loyalty
            <span
              className={`px-1.5 rounded-full text-[10px] font-bold ${
                tab === "top"
                  ? "bg-white/20"
                  : "bg-[color:var(--surface2)] text-[color:var(--muted)]"
              }`}
            >
              {topCount}
            </span>
          </Link>
        </div>
      </div>

      {tab === "top" ? (
        <div className="bg-surface border border-line rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Trophy size={16} className="text-amber-500" />
            <h2 className="font-bold text-sm">Top Pelanggan Saldo Loyalty</h2>
            <span className="ml-auto text-xs text-[color:var(--muted)]">
              {top.length} dari {topCount} pelanggan
            </span>
          </div>
          {top.length === 0 ? (
            <div className="text-center py-8 text-sm text-[color:var(--muted)]">
              Belum ada pelanggan dengan saldo loyalty.
            </div>
          ) : (
            <div className="space-y-1.5">
              {top.map((t, i) => (
                <Link
                  key={t.id}
                  href={`/data-pelanggan/${t.id}`}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-[color:var(--surface2)] transition"
                >
                  <span
                    className={`w-7 h-7 rounded-full text-white text-xs font-extrabold grid place-items-center flex-shrink-0 ${
                      RANK_BG[i] ?? "bg-[color:var(--muted)]"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className="flex-1 text-sm font-semibold truncate">{t.nama}</span>
                  <span className="text-sm font-extrabold text-brand whitespace-nowrap">
                    {formatRupiah(t.saldoLoyalti)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          <PelangganTable
            rows={list.map((p) => {
              const u = p.userId ? userMap.get(p.userId) : null;
              return {
                ...p,
                titipanTotal: titipanMap.get(p.id) ?? 0,
                piutangTotal: piutangMap.get(p.id) ?? 0,
                linkedUser: u
                  ? { id: u.id, name: u.name, email: u.email, username: u.username }
                  : null,
              };
            })}
            canDelete={session.user.role === "admin"}
            q={q}
          />
          <Pagination page={page} totalPages={totalPages} total={total} />
        </>
      )}
    </div>
  );
}
