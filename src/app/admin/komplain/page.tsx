import { eq, desc, sql, and, or, like } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { komplain } from "@/db/schema/komplain";
import { pelanggan as pelangganTable } from "@/db/schema/pelanggan";
import { user as userTable } from "@/db/schema/auth";
import { PageHeader } from "@/components/AppShell";
import { requireRole } from "@/lib/permissions";
import { PageSizeSelect } from "@/components/PageSizeSelect";
import { Pagination } from "@/components/Pagination";
import { parseLimit, parsePage, getPagination } from "@/lib/page-size";
import { KomplainAdminClient } from "./KomplainAdminClient";

export const dynamic = "force-dynamic";

const STATUS_TABS = ["baru", "diproses", "selesai", "ditolak", "all"] as const;
type StatusTab = (typeof STATUS_TABS)[number];

export default async function KomplainAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; limit?: string; page?: string; q?: string }>;
}) {
  await requireRole(["admin"]);
  const sp = await searchParams;
  const status = (STATUS_TABS as readonly string[]).includes(sp.status ?? "")
    ? (sp.status as StatusTab)
    : "baru";
  const limit = parseLimit(sp.limit);
  const pageParam = parsePage(sp.page);
  const q = (sp.q ?? "").trim();

  const conds = [];
  if (status !== "all")
    conds.push(eq(komplain.status, status as Exclude<StatusTab, "all">));
  if (q) {
    const pat = `%${q}%`;
    conds.push(
      or(
        like(pelangganTable.nama, pat),
        like(pelangganTable.telp, pat),
        like(komplain.deskripsi, pat),
      )!,
    );
  }
  const whereClause = conds.length > 0 ? and(...conds) : undefined;

  const [aggRow] = await db
    .select({ n: sql<number>`count(*)` })
    .from(komplain)
    .leftJoin(pelangganTable, eq(komplain.pelangganId, pelangganTable.id))
    .where(whereClause);
  const total = aggRow?.n ?? 0;
  const { page, totalPages, offset } = getPagination({ total, limit, page: pageParam });

  // Counts per status for tab badges
  const counts = await db
    .select({
      status: komplain.status,
      n: sql<number>`count(*)`,
    })
    .from(komplain)
    .groupBy(komplain.status);
  const countMap = Object.fromEntries(counts.map((c) => [c.status, c.n])) as Record<
    string,
    number
  >;

  const rows = await db
    .select({
      id: komplain.id,
      pelangganId: komplain.pelangganId,
      pelangganNama: pelangganTable.nama,
      pelangganTelp: pelangganTable.telp,
      refOrderId: komplain.refOrderId,
      jenis: komplain.jenis,
      deskripsi: komplain.deskripsi,
      fotoUrl: komplain.fotoUrl,
      status: komplain.status,
      resolusi: komplain.resolusi,
      kompensasiLoyalti: komplain.kompensasiLoyalti,
      createdAt: komplain.createdAt,
      resolvedAt: komplain.resolvedAt,
      resolvedByName: userTable.name,
    })
    .from(komplain)
    .leftJoin(pelangganTable, eq(komplain.pelangganId, pelangganTable.id))
    .leftJoin(userTable, eq(komplain.resolvedBy, userTable.id))
    .where(whereClause)
    .orderBy(desc(komplain.createdAt))
    .limit(limit)
    .offset(offset);

  return (
    <div className="p-4 md:p-6 max-w-5xl space-y-4">
      <PageHeader
        title="Komplain Pelanggan"
        description="Tindak lanjuti komplain. Bisa kasih kompensasi loyalty atau tolak dengan alasan."
      />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_TABS.map((s) => {
            const isActive = status === s;
            const c = s === "all" ? total : countMap[s] ?? 0;
            return (
              <Link
                key={s}
                href={`/admin/komplain?status=${s}`}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition ${
                  isActive
                    ? "bg-brand text-white"
                    : "bg-surface border border-line text-[color:var(--muted)] hover:text-ink"
                }`}
              >
                {s === "all" ? "Semua" : s.charAt(0).toUpperCase() + s.slice(1)}
                {c > 0 && (
                  <span
                    className={`ml-1 px-1.5 py-0 rounded text-[10px] ${
                      isActive
                        ? "bg-white/30"
                        : "bg-[color:var(--accent2)] text-white"
                    }`}
                  >
                    {c}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
        <PageSizeSelect value={limit} />
      </div>

      <form className="flex gap-2 items-center">
        <input type="hidden" name="status" value={status} />
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Cari nama / telp pelanggan / isi komplain..."
          className="flex-1 px-3 py-2 border border-line rounded-md text-sm"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-brand-600 text-white rounded-md text-sm font-bold"
        >
          Cari
        </button>
        {q && (
          <a
            href={`/admin/komplain?status=${status}`}
            className="px-3 py-2 text-sm text-[color:var(--muted)] hover:text-ink"
          >
            Reset
          </a>
        )}
      </form>

      <KomplainAdminClient
        rows={rows.map((r) => ({
          id: r.id,
          pelangganId: r.pelangganId,
          pelangganNama: r.pelangganNama ?? "—",
          pelangganTelp: r.pelangganTelp,
          refOrderId: r.refOrderId,
          jenis: r.jenis,
          deskripsi: r.deskripsi,
          fotoUrl: r.fotoUrl,
          status: r.status,
          resolusi: r.resolusi,
          kompensasiLoyalti: r.kompensasiLoyalti,
          createdAt: r.createdAt.toISOString(),
          resolvedAt: r.resolvedAt?.toISOString() ?? null,
          resolvedByName: r.resolvedByName,
        }))}
      />

      <Pagination page={page} totalPages={totalPages} total={total} />
    </div>
  );
}
