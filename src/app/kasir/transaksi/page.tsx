import Link from "next/link";
import { db } from "@/db";
import { eq, desc, and, gte, lte } from "drizzle-orm";
import { transaksi } from "@/db/schema/transaksi";
import { user as userTable } from "@/db/schema/auth";
import { pelanggan } from "@/db/schema/pelanggan";
import { PageHeader } from "@/components/AppShell";
import { formatRupiah } from "@/lib/utils";
import { requireRole } from "@/lib/permissions";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { parseRange } from "@/lib/date-range";

export const dynamic = "force-dynamic";

export default async function RiwayatKasirPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const session = await requireRole(["admin", "kasir"]);
  const role = session.user.role;
  const sp = await searchParams;
  const range = parseRange(sp);

  const conds = [];
  if (role !== "admin") conds.push(eq(transaksi.kasirUserId, session.user.id));
  if (range.from) conds.push(gte(transaksi.createdAt, range.from));
  if (range.to) conds.push(lte(transaksi.createdAt, range.to));

  const rows = await db
    .select({
      id: transaksi.id,
      nomorNota: transaksi.nomorNota,
      total: transaksi.total,
      metodeBayar: transaksi.metodeBayar,
      createdAt: transaksi.createdAt,
      kasir: userTable.name,
      pelangganNama: pelanggan.nama,
    })
    .from(transaksi)
    .leftJoin(userTable, eq(transaksi.kasirUserId, userTable.id))
    .leftJoin(pelanggan, eq(transaksi.pelangganId, pelanggan.id))
    .where(conds.length > 0 ? and(...conds) : undefined)
    .orderBy(desc(transaksi.createdAt))
    .limit(200);

  const totalOmzet = rows.reduce((s, r) => s + r.total, 0);

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title="Riwayat Transaksi"
        description={role === "admin" ? "Semua transaksi." : "Transaksi yang Anda buat."}
      />
      <div className="mb-4">
        <DateRangeFilter
          active={range.key}
          customFrom={range.from}
          customTo={range.to}
          basePath="/kasir/transaksi"
        />
      </div>
      <div className="mb-3 flex items-center justify-between flex-wrap gap-2 text-sm">
        <span className="text-[color:var(--muted)]">{rows.length} transaksi</span>
        <span className="font-bold text-brand">
          Omzet: {formatRupiah(totalOmzet)}
        </span>
      </div>
      <div className="bg-surface rounded-xl border border-line overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[color:var(--surface2)] text-[color:var(--muted)] text-left">
            <tr>
              <th className="p-3">Waktu</th>
              <th className="p-3">No. Nota</th>
              <th className="p-3">Pelanggan</th>
              <th className="p-3">Kasir</th>
              <th className="p-3">Bayar</th>
              <th className="p-3 text-right">Total</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-[color:var(--surface2)]">
                <td className="p-3 text-xs text-[color:var(--muted)]">
                  {r.createdAt.toLocaleString("id-ID")}
                </td>
                <td className="p-3 font-mono text-xs">{r.nomorNota}</td>
                <td className="p-3">{r.pelangganNama ?? <span className="text-[color:var(--muted)]">walk-in</span>}</td>
                <td className="p-3">{r.kasir ?? "-"}</td>
                <td className="p-3 uppercase text-xs">{r.metodeBayar}</td>
                <td className="p-3 text-right font-medium">{formatRupiah(r.total)}</td>
                <td className="p-3 text-right">
                  <Link
                    href={`/kasir/transaksi/${r.id}`}
                    className="text-xs text-brand-600 hover:underline"
                  >
                    Nota
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="p-4 md:p-6 text-center text-[color:var(--muted)]">
                  Belum ada transaksi.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
