import { formatRupiah } from "@/lib/utils";

export type NotaItem = {
  namaProduk: string;
  qty: number;
  hargaSatuan: number;
  subtotal: number;
  jenis: string;
};

export type NotaPaperProps = {
  header: {
    namaDepot: string;
    alamatDepot?: string;
    telpDepot?: string;
  };
  meta: {
    nomor: string;
    tanggal: Date;
    kasirNama?: string | null;
    pelangganNama: string;
  };
  items: NotaItem[];
  totals: {
    subtotal: number;
    diskon?: number;
    loyalti?: number;
    total: number;
    metodeBayar?: string | null;
    statusBayar?: string | null;
    statusOrder?: string | null;
  };
  catatan?: string | null;
  footer?: string;
};

/**
 * Shared receipt/nota layout. Pakai @media print untuk hide sibling
 * non-print elements. Wrap dengan div className="nota-paper" supaya match selector.
 */
export function NotaPaper({ header, meta, items, totals, catatan, footer }: NotaPaperProps) {
  const isLunas = totals.statusBayar === "lunas";
  const dokumenLabel = isLunas ? "NOTA" : "INVOICE";
  const footerText = isLunas
    ? footer ?? "Terima kasih atas kunjungan Anda 🙏"
    : "Mohon segera lakukan pembayaran.";
  return (
    <div className="nota-paper bg-surface rounded-lg shadow-sm border border-line p-6 font-mono text-sm">
      <div className="text-center border-b border-dashed border-line pb-3 mb-3">
        <div
          className={`text-lg font-extrabold tracking-widest mb-1 ${
            isLunas ? "text-emerald-600" : "text-amber-600"
          }`}
        >
          {dokumenLabel}
        </div>
        <div className="font-bold text-base">{header.namaDepot}</div>
        {header.alamatDepot && <div className="text-xs">{header.alamatDepot}</div>}
        {header.telpDepot && <div className="text-xs">Telp: {header.telpDepot}</div>}
      </div>

      <div className="space-y-1 text-xs mb-3">
        <Row label="No. Nota" value={meta.nomor} />
        <Row label="Tanggal" value={meta.tanggal.toLocaleString("id-ID")} />
        {meta.kasirNama && <Row label="Kasir" value={meta.kasirNama} />}
        <Row label="Pelanggan" value={meta.pelangganNama} />
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
        <Row label="Subtotal" value={formatRupiah(totals.subtotal)} />
        {totals.diskon !== undefined && totals.diskon > 0 && (
          <Row label="Diskon" value={`- ${formatRupiah(totals.diskon)}`} />
        )}
        {totals.loyalti !== undefined && totals.loyalti > 0 && (
          <Row label="Saldo Loyalty" value={`- ${formatRupiah(totals.loyalti)}`} />
        )}
        <Row label="TOTAL" value={formatRupiah(totals.total)} bold />
        {totals.metodeBayar && (
          <Row label="Bayar" value={totals.metodeBayar.toUpperCase()} />
        )}
        {totals.statusBayar && (
          <Row label="Status Bayar" value={totals.statusBayar.toUpperCase()} />
        )}
        {totals.statusOrder && (
          <Row label="Status Order" value={totals.statusOrder.toUpperCase()} />
        )}
      </div>

      {catatan && (
        <div className="mt-3 pt-2 border-t border-dashed border-line text-xs">
          <div className="font-medium">Catatan:</div>
          <div className="text-ink">{catatan}</div>
        </div>
      )}

      <div className="text-center text-xs mt-4 pt-3 border-t border-dashed border-line">
        {footerText}
      </div>
    </div>
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
