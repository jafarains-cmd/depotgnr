import { EscPos, charsPerLine, type PaperSize } from "./escpos";
import { formatRupiah } from "./utils";

/**
 * Data nota generic — subset dari NotaPaperProps (yang di-render sebagai HTML)
 * ditambah field opsional. Sama untuk semua tipe nota (kasir, order, shift, dll).
 */
export type NotaData = {
  header: {
    namaDepot: string;
    alamatDepot?: string | null;
    telpDepot?: string | null;
  };
  dokumenLabel?: string; // default "NOTA"
  meta: {
    nomor: string;
    tanggal: Date;
    kasirNama?: string | null;
    pelangganNama?: string | null;
    alamatAntar?: string | null;
  };
  items: Array<{
    namaProduk: string;
    qty: number;
    hargaSatuan: number;
    subtotal: number;
    jenis?: string;
  }>;
  totals: {
    subtotal: number;
    diskon?: number;
    loyalti?: number;
    total: number;
    metodeBayar?: string | null;
    statusBayar?: string | null;
    bayar?: number | null;
    kembalian?: number | null;
  };
  catatan?: string | null;
  footer?: string;
};

function fmt(n: number): string {
  return formatRupiah(n).replace(/^Rp\s?/, "");
}

/**
 * Convert data nota → byte array ESC/POS untuk thermal printer.
 * Auto-adapt untuk paper size 58mm (32 chars) atau 80mm (48 chars).
 */
export function notaToEscpos(nota: NotaData, paperSize: PaperSize): number[] {
  const width = charsPerLine(paperSize);
  const p = new EscPos();
  const label = nota.dokumenLabel ?? (nota.totals.statusBayar === "lunas" ? "NOTA" : "INVOICE");

  p.init()
    .align(1) // center
    .bold(true)
    .size(0x10) // double height
    .line(nota.header.namaDepot)
    .size(0x00)
    .bold(false);

  if (nota.header.alamatDepot) p.wrap(nota.header.alamatDepot, width);
  if (nota.header.telpDepot) p.line(`Telp: ${nota.header.telpDepot}`);

  p.sep(width, "=");

  p.bold(true).line(label).bold(false);
  p.align(0); // left

  p.twoCol("No", `: ${nota.meta.nomor}`, width);
  const tgl = nota.meta.tanggal.toLocaleString("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  p.twoCol("Tgl", `: ${tgl}`, width);
  if (nota.meta.kasirNama) p.twoCol("Kasir", `: ${nota.meta.kasirNama}`, width);
  if (nota.meta.pelangganNama) p.twoCol("Plg", `: ${nota.meta.pelangganNama}`, width);
  if (nota.meta.alamatAntar) {
    p.line("Alamat:");
    p.wrap(nota.meta.alamatAntar, width, "  ");
  }
  p.sep(width);

  // Items
  for (const it of nota.items) {
    // Line 1: nama produk (kalau panjang wrap)
    const namaFull = `${it.namaProduk}${it.jenis ? ` (${it.jenis.replace(/_/g, " ")})` : ""}`;
    p.wrap(namaFull, width);
    // Line 2: qty x harga | subtotal
    const left = `  ${it.qty} x ${fmt(it.hargaSatuan)}`;
    const right = fmt(it.subtotal);
    p.twoCol(left, right, width);
  }
  p.sep(width);

  // Totals
  p.twoCol("Subtotal", fmt(nota.totals.subtotal), width);
  if (nota.totals.diskon && nota.totals.diskon > 0) {
    p.twoCol("Diskon", `-${fmt(nota.totals.diskon)}`, width);
  }
  if (nota.totals.loyalti && nota.totals.loyalti > 0) {
    p.twoCol("Loyalti", `-${fmt(nota.totals.loyalti)}`, width);
  }
  p.bold(true).twoCol("TOTAL", fmt(nota.totals.total), width).bold(false);

  if (nota.totals.metodeBayar) {
    p.twoCol("Bayar", nota.totals.metodeBayar.toUpperCase(), width);
  }
  if (nota.totals.bayar !== undefined && nota.totals.bayar !== null) {
    p.twoCol("Dibayar", fmt(nota.totals.bayar), width);
  }
  if (nota.totals.kembalian !== undefined && nota.totals.kembalian !== null && nota.totals.kembalian > 0) {
    p.twoCol("Kembali", fmt(nota.totals.kembalian), width);
  }
  if (nota.totals.statusBayar) {
    p.twoCol("Status", nota.totals.statusBayar.toUpperCase(), width);
  }

  if (nota.catatan) {
    p.sep(width);
    p.line("Catatan:");
    p.wrap(nota.catatan, width);
  }

  p.sep(width, "=");
  p.align(1); // center
  p.line(nota.footer ?? "Terima kasih 🙏".replace("🙏", ""));
  p.line("~ DEPOT GNR ~");
  p.feed(3);
  p.cut(1); // partial cut

  return p.build();
}
