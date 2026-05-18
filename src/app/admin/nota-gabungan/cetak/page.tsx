import { notFound, redirect } from "next/navigation";
import { inArray, eq } from "drizzle-orm";
import { db } from "@/db";
import { orderHeader, orderItem } from "@/db/schema/order";
import { pelanggan as pelangganTable } from "@/db/schema/pelanggan";
import { produk as produkTable } from "@/db/schema/produk";
import { pengaturan } from "@/db/schema/pengaturan";
import { requireRole } from "@/lib/permissions";
import { formatRupiah } from "@/lib/utils";
import { generateNomorNota } from "@/lib/utils";
import { CetakActions } from "./CetakActions";

export const dynamic = "force-dynamic";

export default async function CetakNotaGabunganPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  await requireRole(["admin", "kasir"]);
  const sp = await searchParams;
  const ids = (sp.ids ?? "")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);

  if (ids.length === 0) redirect("/admin/nota-gabungan");

  const orders = await db
    .select()
    .from(orderHeader)
    .where(inArray(orderHeader.id, ids));

  if (orders.length === 0) notFound();

  // Wajib pelanggan sama
  const pelangganIds = [...new Set(orders.map((o) => o.pelangganId))];
  if (pelangganIds.length !== 1 || pelangganIds[0] === null) {
    return (
      <div className="p-6 max-w-md mx-auto">
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-sm text-rose-900">
          Order yang dipilih harus dari pelanggan yang sama (dan bukan walk-in tanpa pelanggan).
        </div>
      </div>
    );
  }
  const pel = await db.query.pelanggan.findFirst({
    where: eq(pelangganTable.id, pelangganIds[0]!),
  });

  // Ambil items semua order
  const allItems = await db
    .select({
      orderId: orderItem.orderId,
      qty: orderItem.qty,
      hargaEstimasi: orderItem.hargaEstimasi,
      jenis: orderItem.jenis,
      namaProduk: produkTable.nama,
    })
    .from(orderItem)
    .leftJoin(produkTable, eq(orderItem.produkId, produkTable.id))
    .where(inArray(orderItem.orderId, ids));

  const itemsByOrder = new Map<number, typeof allItems>();
  for (const it of allItems) {
    const arr = itemsByOrder.get(it.orderId) ?? [];
    arr.push(it);
    itemsByOrder.set(it.orderId, arr);
  }

  const cfgRows = await db.query.pengaturan.findMany();
  const cfg = Object.fromEntries(cfgRows.map((r) => [r.key, r.value ?? ""]));
  void pengaturan;

  // Sortir order lama → baru supaya cetakan urut
  const sortedOrders = [...orders].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );

  const totalSemua = sortedOrders.reduce((s, o) => s + o.totalEstimasi, 0);
  const loyaltyDipakai = sortedOrders.reduce((s, o) => s + (o.loyaltiDipakai ?? 0), 0);
  const totalGalonSemua = sortedOrders.reduce((s, o) => {
    const its = itemsByOrder.get(o.id) ?? [];
    return s + its.reduce((sg, it) => sg + it.qty, 0);
  }, 0);

  const allLunas = sortedOrders.every((o) => o.statusBayar === "lunas");
  const adaBelumLunas = sortedOrders.some((o) => o.statusBayar !== "lunas");

  const nomorGabungan = `GAB-${generateNomorNota("").replace("-", "")}`.slice(0, 18);
  const orderIdsSerialized = sortedOrders.map((o) => o.id);
  const tanggalCetak = new Date();

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .nota-paper { box-shadow: none !important; border: none !important; }
        }
      `}</style>
      <div className="min-h-screen py-4 print:py-0">
        <div className="max-w-md mx-auto px-3">
          <div className="no-print mb-4">
            <CetakActions
              orderIds={orderIdsSerialized}
              adaBelumLunas={adaBelumLunas}
              allLunas={allLunas}
            />
          </div>

          <div className="nota-paper bg-surface rounded-lg shadow-sm border border-line p-6 font-mono text-sm">
            <div className="text-center border-b border-dashed border-line pb-3 mb-3">
              <div
                className={`text-lg font-extrabold tracking-widest mb-1 ${
                  allLunas ? "text-emerald-600" : "text-amber-600"
                }`}
              >
                NOTA GABUNGAN
              </div>
              <div className="font-bold text-base">{cfg.namaDepot || "Depot Air Minum"}</div>
              {cfg.alamatDepot && <div className="text-xs">{cfg.alamatDepot}</div>}
              {cfg.telpDepot && <div className="text-xs">Telp: {cfg.telpDepot}</div>}
            </div>

            <div className="space-y-1 text-xs mb-3">
              <Row label="No. Gabungan" value={nomorGabungan} />
              <Row label="Tanggal Cetak" value={tanggalCetak.toLocaleString("id-ID")} />
              <Row label="Pelanggan" value={pel?.nama ?? "—"} />
              {pel?.telp && <Row label="Telp" value={pel.telp} />}
              <Row label="Jumlah Order" value={`${sortedOrders.length} order`} />
            </div>

            <div className="border-t border-dashed border-line pt-2 mb-2">
              <div className="text-[10px] font-bold tracking-widest text-[color:var(--muted)] mb-1">
                RINCIAN PER ORDER
              </div>
              {sortedOrders.map((o, idx) => {
                const its = itemsByOrder.get(o.id) ?? [];
                const subtotalOrder = its.reduce(
                  (s, it) => s + (it.hargaEstimasi ?? 0) * it.qty,
                  0,
                );
                return (
                  <div
                    key={o.id}
                    className={`text-xs pb-2 ${idx < sortedOrders.length - 1 ? "border-b border-dotted border-line mb-2" : ""}`}
                  >
                    <div className="flex justify-between font-bold">
                      <span>{o.nomorOrder}</span>
                      <span
                        className={
                          o.statusBayar === "lunas"
                            ? "text-emerald-700"
                            : "text-amber-700"
                        }
                      >
                        {o.statusBayar.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-[10px] text-[color:var(--muted)]">
                      {o.createdAt.toLocaleString("id-ID")}
                    </div>
                    {its.map((it, j) => (
                      <div key={j} className="flex justify-between mt-1">
                        <span>
                          {it.namaProduk ?? "-"}{" "}
                          <span className="text-[color:var(--muted)]">
                            ({it.qty} × {formatRupiah(it.hargaEstimasi ?? 0)} · {it.jenis})
                          </span>
                        </span>
                        <span>{formatRupiah((it.hargaEstimasi ?? 0) * it.qty)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between font-bold mt-1">
                      <span>Subtotal Order</span>
                      <span>{formatRupiah(subtotalOrder)}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-dashed border-line pt-2 space-y-1 text-xs">
              <Row label="Total Galon" value={`${totalGalonSemua} galon`} />
              {loyaltyDipakai > 0 && (
                <Row label="Saldo Loyalty" value={`- ${formatRupiah(loyaltyDipakai)}`} />
              )}
              <Row label="TOTAL GABUNGAN" value={formatRupiah(totalSemua)} bold />
              <Row
                label="Status Bayar"
                value={
                  allLunas
                    ? "SEMUA LUNAS"
                    : `${sortedOrders.filter((o) => o.statusBayar !== "lunas").length} BELUM LUNAS`
                }
              />
            </div>

            <div className="text-center text-xs mt-4 pt-3 border-t border-dashed border-line">
              {allLunas
                ? cfg.footerNota || "Terima kasih atas kunjungan Anda 🙏"
                : "Mohon segera lakukan pembayaran untuk order yang belum lunas."}
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
