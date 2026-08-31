import Link from "next/link";
import { AlertCircle, Phone } from "lucide-react";
import { requireRole } from "@/lib/permissions";
import { PageHeader } from "@/components/AppShell";
import { getLanggananInaktif } from "@/lib/langganan";

export const dynamic = "force-dynamic";

export default async function LanggananInaktifPage() {
  await requireRole(["admin", "kasir"]);
  const rows = await getLanggananInaktif();

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title="Langganan Inaktif"
        description={`${rows.length} pelanggan langganan pegang galon depot tapi tidak order >= 30 hari. Follow up untuk tagih pengembalian atau order baru.`}
      />

      {rows.length === 0 ? (
        <div className="bg-surface border border-line rounded-2xl p-8 text-center">
          <AlertCircle size={40} className="mx-auto text-emerald-500 mb-3" />
          <div className="font-bold">Semua langganan aktif ✓</div>
          <p className="text-sm text-[color:var(--muted)] mt-1">
            Tidak ada pelanggan langganan yang pegang galon tanpa order &gt;30 hari.
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {rows.map((r) => (
            <div key={r.pelangganId} className="bg-surface border border-line rounded-2xl p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-sm truncate">{r.nama}</div>
                  {r.telp && (
                    <div className="text-xs text-[color:var(--muted)] inline-flex items-center gap-1">
                      <Phone size={11} /> {r.telp}
                    </div>
                  )}
                </div>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                  {r.hariTidakOrder}h
                </span>
              </div>
              <div className="mt-2 text-xs text-[color:var(--muted)]">
                Pegang <b className="text-amber-700">{r.galonDipegang}</b> galon depot ·
                Order terakhir{" "}
                {r.lastOrderAt
                  ? r.lastOrderAt.toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : "belum pernah"}
              </div>
              <div className="mt-2 flex gap-2">
                <Link
                  href={`/data-pelanggan/${r.pelangganId}`}
                  className="text-[11px] text-brand hover:underline"
                >
                  Detail →
                </Link>
                {r.telp && (
                  <a
                    href={`https://wa.me/62${r.telp.replace(/^0/, "")}?text=${encodeURIComponent(
                      `Halo ${r.nama}, kami dari DEPOT GNR. Anda masih pegang ${r.galonDipegang} galon depot dan belum order dalam ${r.hariTidakOrder} hari terakhir. Apakah butuh order baru atau ingin kembalikan galon?`,
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-emerald-600 hover:underline inline-flex items-center gap-0.5"
                  >
                    <Phone size={10} /> WA
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
