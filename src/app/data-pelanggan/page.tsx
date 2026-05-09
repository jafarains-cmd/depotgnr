import Link from "next/link";
import { Trophy } from "lucide-react";
import { desc, gt } from "drizzle-orm";
import { db } from "@/db";
import { pelanggan as pelangganTable } from "@/db/schema/pelanggan";
import { requireRole } from "@/lib/permissions";
import { formatRupiah } from "@/lib/utils";
import { PelangganTable } from "./PelangganTable";
import { PageSizeSelect } from "@/components/PageSizeSelect";
import { parseLimit } from "@/lib/page-size";

export const dynamic = "force-dynamic";

const RANK_BG = ["bg-amber-400", "bg-slate-300", "bg-orange-400"];

export default async function PelangganDataPage({
  searchParams,
}: {
  searchParams: Promise<{ limit?: string }>;
}) {
  const session = await requireRole(["admin", "kasir"]);
  const sp = await searchParams;
  const limit = parseLimit(sp.limit);
  const [list, top] = await Promise.all([
    db.query.pelanggan.findMany({
      orderBy: (p, { desc }) => [desc(p.createdAt)],
      limit,
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
      .limit(10),
  ]);

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold">Data Pelanggan</h1>
          <p className="text-sm text-[color:var(--muted)]">
            Walk-in dan langganan. Klik nama untuk lihat detail saldo loyalty & history.
          </p>
        </div>
        <PageSizeSelect value={limit} />
      </div>

      {top.length > 0 && (
        <div className="bg-surface border border-line rounded-2xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Trophy size={16} className="text-amber-500" />
            <h2 className="font-bold text-sm">Top Pelanggan Saldo Loyalty</h2>
          </div>
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
        </div>
      )}

      <PelangganTable rows={list} canDelete={session.user.role === "admin"} />
    </div>
  );
}
