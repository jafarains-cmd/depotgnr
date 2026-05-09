/**
 * Preset kategori filter dengan interval default (hari).
 * User bisa override interval per filter saat create.
 */
export const KATEGORI_FILTER = [
  { value: "carbon", label: "Carbon Filter", defaultInterval: 180 },
  { value: "sediment", label: "Sediment Filter", defaultInterval: 90 },
  { value: "membran_ro", label: "Membran RO", defaultInterval: 730 },
  { value: "uv_lamp", label: "Lampu UV", defaultInterval: 365 },
  { value: "lainnya", label: "Lainnya", defaultInterval: 180 },
] as const;

export type KategoriFilter = (typeof KATEGORI_FILTER)[number]["value"];

export function kategoriLabel(k: string): string {
  const found = KATEGORI_FILTER.find((kk) => kk.value === k);
  return found?.label ?? k;
}
