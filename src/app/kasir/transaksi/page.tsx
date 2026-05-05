import Link from "next/link";
import { db } from "@/db";
import { eq, desc, and, gte, lte, like, or } from "drizzle-orm";
import { TransaksiRow } from "./TransaksiRow";
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
  searchParams: Promise<{ range?: string; from?: string; to?: string; q?: string }>;
}) {
  const session = await requireRole(["admin", "kasir"]);
  const role = session.user.role;
  const sp = await searchParams;
  const range = parseRange(sp);
  const q = (sp.q ?? "").trim();

  const conds = [];
  if (role !== "admin") conds.push(eq(transaksi.kasirUserId, session.user.id));
  if (range.from) conds.push(gte(transaksi.createdAt, range.from));
  if (range.to) conds.push(lte(transaksi.createdAt, range.to));
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
    .where(conds.length > 0 ? and(...conds) : undefined)
    .orderBy(desc(transaksi.createdAt))
    .limit(200);

  const totalOmzet = rows.reduce((s, r) => (r.voidedAt ? s : s + r.total), 0);

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
        <form className="flex gap-2 items-center">
          {range.key && <input type="hidden" name="range" value={range.key} />}
          {sp.from && <input type="hidden" name="from" value={sp.from} />}
          {sp.to && <input type="hidden" name="to" value={sp.to} />}
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
        <span className="text-[color:var(--muted)]">{rows.length} transaksi</span>
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
                      <span className="ml-1 text-[9px] px-1 py-0.5 bg-red-100 text-red-700 rounded font-bold">
                        BATAL
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
    </div>
  );
}
