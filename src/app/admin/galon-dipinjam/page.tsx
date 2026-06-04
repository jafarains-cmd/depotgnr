import Link from "next/link";
import { Truck } from "lucide-react";
import { requireRole } from "@/lib/permissions";
import { summaryGalonPinjam } from "@/lib/galon-pinjam";
import { PageHeader } from "@/components/AppShell";

export const dynamic = "force-dynamic";

export default async function GalonDipinjamPage() {
  await requireRole(["admin"]);
  const rows = await summaryGalonPinjam();
  const grandTotal = rows.reduce((s, r) => s + r.totalGalon, 0);

  return (
    <div className="p-4 md:p-6 max-w-4xl space-y-4">
      <PageHeader
        title="Galon Depot Dipinjam"
        description="Daftar pelanggan yang sedang memegang galon milik depot."
      />

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-900 inline-flex items-center gap-2">
        <Truck size={16} />
        <span>
          Total <b>{grandTotal} galon</b> depot ada di tangan <b>{rows.length} pelanggan</b>
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="bg-surface border border-line rounded-2xl p-8 text-center text-sm text-[color:var(--muted)]">
          Tidak ada pelanggan yang sedang memegang galon depot.
        </div>
      ) : (
        <div className="bg-surface border border-line rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[color:var(--surface2)] text-[color:var(--muted)] text-left text-xs">
              <tr>
                <th className="p-3">#</th>
                <th className="p-3">Pelanggan</th>
                <th className="p-3 hidden sm:table-cell">Telp</th>
                <th className="p-3 text-right">Galon Dipegang</th>
                <th className="p-3 hidden md:table-cell">Update Terakhir</th>
                <th className="p-3 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r, idx) => (
                <tr key={r.pelangganId}>
                  <td className="p-3 text-xs text-[color:var(--muted)]">{idx + 1}</td>
                  <td className="p-3 font-bold">{r.nama}</td>
                  <td className="p-3 text-xs hidden sm:table-cell">{r.telp ?? "—"}</td>
                  <td className="p-3 text-right font-mono font-bold text-amber-700">
                    {r.totalGalon} galon
                  </td>
                  <td className="p-3 text-xs hidden md:table-cell">
                    {r.lastUpdate.toLocaleString("id-ID", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </td>
                  <td className="p-3 text-right">
                    <Link
                      href={`/data-pelanggan/${r.pelangganId}`}
                      className="text-xs text-brand hover:underline"
                    >
                      Detail →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
