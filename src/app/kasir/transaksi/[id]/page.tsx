import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { transaksi, transaksiItem } from "@/db/schema/transaksi";
import { produk } from "@/db/schema/produk";
import { pelanggan } from "@/db/schema/pelanggan";
import { user as userTable } from "@/db/schema/auth";
import { pengaturan } from "@/db/schema/pengaturan";
import { requireRole } from "@/lib/permissions";
import { formatRupiah } from "@/lib/utils";
import { NotaActions } from "./NotaActions";

export const dynamic = "force-dynamic";

export default async function NotaPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole(["admin", "kasir"]);
  const isAdmin = session.user.role === "admin";
  const { id } = await params;
  const trxId = Number(id);
  if (!trxId) notFound();

  const t = await db.query.transaksi.findFirst({ where: eq(transaksi.id, trxId) });
  if (!t) notFound();

  const items = await db
    .select({
      qty: transaksiItem.qty,
      hargaSatuan: transaksiItem.hargaSatuan,
      subtotal: transaksiItem.subtotal,
      jenis: transaksiItem.jenis,
      namaProduk: produk.nama,
    })
    .from(transaksiItem)
    .leftJoin(produk, eq(transaksiItem.produkId, produk.id))
    .where(eq(transaksiItem.transaksiId, trxId));

  const pel = t.pelangganId
    ? await db.query.pelanggan.findFirst({ where: eq(pelanggan.id, t.pelangganId) })
    : null;
  const kasir = t.kasirUserId
    ? await db.query.user.findFirst({ where: eq(userTable.id, t.kasirUserId) })
    : null;

  const cfgRows = await db.query.pengaturan.findMany();
  const cfg = Object.fromEntries(cfgRows.map((r) => [r.key, r.value ?? ""]));

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .nota-paper { box-shadow: none !important; border: none !important; }
        }
      `}</style>
      <div className="min-h-screen bg-[color:var(--surface2)] py-8 print:py-0 print:bg-surface">
        <div className="max-w-md mx-auto">
          <div className="no-print mb-4">
            <NotaActions
              trxId={t.id}
              pelangganTelp={pel?.telp ?? null}
              pelangganUserId={pel?.userId ?? null}
              voided={!!t.voidedAt}
              canVoid={isAdmin}
              ageDays={Math.floor((Date.now() - t.createdAt.getTime()) / (1000 * 60 * 60 * 24))}
            />
          </div>

          {t.voidedAt && (
            <div className="no-print mb-4 bg-red-50 border-2 border-red-200 rounded-2xl p-4 text-center">
              <div className="text-red-700 font-extrabold text-lg">TRANSAKSI DIBATALKAN</div>
              <div className="text-xs text-red-600 mt-1">
                Dibatalkan {t.voidedAt.toLocaleString("id-ID")}
                {t.voidedAlasan && ` · Alasan: ${t.voidedAlasan}`}
              </div>
            </div>
          )}

          <div className={`nota-paper bg-surface rounded-lg shadow-sm border border-line p-6 font-mono text-sm ${t.voidedAt ? "opacity-60" : ""}`}>
            {t.voidedAt && (
              <div className="text-center text-red-600 font-extrabold tracking-widest text-lg mb-2">
                BATAL
              </div>
            )}
            <div className="text-center border-b border-dashed border-line pb-3 mb-3">
              <div className="font-bold text-base">{cfg.namaDepot || "Depot Air Minum"}</div>
              {cfg.alamatDepot && <div className="text-xs">{cfg.alamatDepot}</div>}
              {cfg.telpDepot && <div className="text-xs">Telp: {cfg.telpDepot}</div>}
            </div>

            <div className="space-y-1 text-xs mb-3">
              <Row label="No. Nota" value={t.nomorNota} />
              <Row label="Tanggal" value={t.createdAt.toLocaleString("id-ID")} />
              <Row label="Kasir" value={kasir?.name ?? "-"} />
              <Row label="Pelanggan" value={pel?.nama ?? "Walk-in"} />
            </div>

            <table className="w-full text-xs border-t border-dashed border-line pt-2">
              <tbody>
                {items.map((it, i) => (
                  <tr key={i} className="align-top">
                    <td className="py-1">
                      <div>{it.namaProduk}</div>
                      <div className="text-[color:var(--muted)]">
                        {it.qty} × {formatRupiah(it.hargaSatuan)} ({it.jenis})
                      </div>
                    </td>
                    <td className="py-1 text-right whitespace-nowrap">
                      {formatRupiah(it.subtotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="border-t border-dashed border-line mt-2 pt-2 space-y-1 text-xs">
              <Row label="Subtotal" value={formatRupiah(t.subtotal)} />
              {t.diskon > 0 && <Row label="Diskon" value={`- ${formatRupiah(t.diskon)}`} />}
              <Row label="TOTAL" value={formatRupiah(t.total)} bold />
              <Row label="Bayar" value={t.metodeBayar.toUpperCase()} />
              <Row label="Status" value={t.status.toUpperCase()} />
            </div>

            {t.catatan && (
              <div className="mt-3 pt-2 border-t border-dashed border-line text-xs">
                <div className="font-medium">Catatan:</div>
                <div className="text-ink">{t.catatan}</div>
              </div>
            )}

            <div className="text-center text-xs mt-4 pt-3 border-t border-dashed border-line">
              {cfg.footerNota || "Terima kasih atas kunjungan Anda 🙏"}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-bold text-sm" : ""}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
