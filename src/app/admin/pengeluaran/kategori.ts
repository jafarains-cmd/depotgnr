export const KATEGORI_OPTIONS = [
  "listrik",
  "air-pdam",
  "sewa",
  "gaji",
  "sparepart",
  "filter",
  "segel",
  "tutup-galon",
  "label",
  "bensin",
  "transport",
  "promosi",
  "konsumsi",
  "perbaikan",
  "lain-lain",
] as const;

export type Kategori = (typeof KATEGORI_OPTIONS)[number];
