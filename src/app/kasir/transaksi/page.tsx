import Link from "next/link";
import { db } from "@/db";
import { eq, desc } from "drizzle-orm";
import { transaksi } from "@/db/schema/transaksi";
import { user as userTable } from "@/db/schema/auth";
import { pelanggan } from "@/db/schema/pelanggan";
import { PageHeader } from "@/components/AppShell";
import { formatRupiah } from "@/lib/utils";
import { requireRole } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function RiwayatKasirPage() {
  const session = await requireRole(["admin", "kasir"]);
  const role = session.user.role;

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
    .where(role === "admin" ? undefined : eq(transaksi.kasirUserId, session.user.id))
    .orderBy(desc(transaksi.createdAt))
    .limit(100);

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title="Riwayat Transaksi"
        description={role === "admin" ? "Semua transaksi (100 terbaru)." : "Transaksi yang Anda buat."}
      />
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
