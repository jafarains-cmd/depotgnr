/**
 * Stylesheet untuk semua halaman laporan. Tampilkan layout tabular yang
 * bersih saat di-cetak (A4), hide nav/filter/tombol.
 */
export function PrintStyles() {
  return (
    <style>{`
      @media print {
        .no-print { display: none !important; }
        body { background: white !important; }
        .laporan-print { padding: 0 !important; }
        .laporan-print section, .laporan-print .rounded-2xl, .laporan-print .rounded-xl {
          box-shadow: none !important;
          border-color: #cbd5e1 !important;
          page-break-inside: avoid;
        }
        .laporan-print thead { display: table-header-group; }
        .laporan-print tr { page-break-inside: avoid; }
        @page { margin: 10mm; size: A4 landscape; }
      }
      .laporan-print .print-only { display: none; }
      @media print { .laporan-print .print-only { display: block; } }
    `}</style>
  );
}

export function PrintHeader({
  title,
  fromStr,
  toStr,
  extra,
}: {
  title: string;
  fromStr: string;
  toStr: string;
  extra?: string;
}) {
  const formatLong = (s: string) =>
    new Date(s).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  return (
    <div className="print-only text-center border-b border-line pb-3 mb-3">
      <div className="text-lg font-extrabold">{title}</div>
      <div className="text-xs mt-1">
        Periode: {formatLong(fromStr)} — {formatLong(toStr)}
      </div>
      {extra && <div className="text-[10px] text-[color:var(--muted)] mt-0.5">{extra}</div>}
      <div className="text-[10px] text-[color:var(--muted)] mt-0.5">
        Dicetak: {new Date().toLocaleString("id-ID")}
      </div>
    </div>
  );
}
