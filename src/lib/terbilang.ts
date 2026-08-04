/**
 * Konversi angka ke terbilang bahasa Indonesia.
 *
 * Handles:
 *  - "seratus" (bukan "satu ratus"), "seribu" (bukan "satu ribu")
 *  - "sepuluh"/"sebelas"/"belasan"
 *  - Sampai milyar
 *  - Negatif (jadi "minus X")
 *
 * Examples:
 *   terbilang(0)      → "nol"
 *   terbilang(150)    → "seratus lima puluh"
 *   terbilang(1500)   → "seribu lima ratus"
 *   terbilang(15000)  → "lima belas ribu"
 *   terbilang(150000) → "seratus lima puluh ribu"
 *   terbilang(2_500_000) → "dua juta lima ratus ribu"
 */

const SATUAN = [
  "",
  "satu",
  "dua",
  "tiga",
  "empat",
  "lima",
  "enam",
  "tujuh",
  "delapan",
  "sembilan",
];

function terbilangBawahSeribu(n: number): string {
  if (n === 0) return "";
  if (n < 10) return SATUAN[n];
  if (n === 10) return "sepuluh";
  if (n === 11) return "sebelas";
  if (n < 20) return `${SATUAN[n - 10]} belas`;
  if (n < 100) {
    const puluhan = Math.floor(n / 10);
    const sisa = n % 10;
    return `${SATUAN[puluhan]} puluh${sisa ? ` ${SATUAN[sisa]}` : ""}`;
  }
  if (n < 200) {
    const sisa = n % 100;
    return `seratus${sisa ? ` ${terbilangBawahSeribu(sisa)}` : ""}`;
  }
  const ratusan = Math.floor(n / 100);
  const sisa = n % 100;
  return `${SATUAN[ratusan]} ratus${sisa ? ` ${terbilangBawahSeribu(sisa)}` : ""}`;
}

export function terbilang(n: number): string {
  if (!Number.isFinite(n)) return "";
  const int = Math.floor(Math.abs(n));
  if (n < 0) return `minus ${terbilang(-int)}`;
  if (int === 0) return "nol";

  const milyar = Math.floor(int / 1_000_000_000);
  const juta = Math.floor((int % 1_000_000_000) / 1_000_000);
  const ribu = Math.floor((int % 1_000_000) / 1_000);
  const sisa = int % 1_000;

  const parts: string[] = [];
  if (milyar) parts.push(`${terbilangBawahSeribu(milyar)} milyar`);
  if (juta) parts.push(`${terbilangBawahSeribu(juta)} juta`);
  if (ribu) {
    if (ribu === 1) parts.push("seribu");
    else parts.push(`${terbilangBawahSeribu(ribu)} ribu`);
  }
  if (sisa) parts.push(terbilangBawahSeribu(sisa));

  return parts.join(" ").trim();
}

/** Terbilang + suffix "rupiah" untuk display. */
export function terbilangRupiah(n: number): string {
  return `${terbilang(n)} rupiah`;
}
