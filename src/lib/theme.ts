export type Palette = "aqua" | "ocean" | "mint" | "sunrise";
export type Mode = "light" | "dark";

export const PALETTES: { id: Palette; name: string; brand: string; accent: string }[] = [
  { id: "aqua", name: "Aqua Fresh", brand: "#00B7E4", accent: "#FFD23F" },
  { id: "ocean", name: "Deep Ocean", brand: "#1E5BFF", accent: "#A6FF6E" },
  { id: "mint", name: "Mint Spring", brand: "#00C39A", accent: "#FFCD3C" },
  { id: "sunrise", name: "Sunrise", brand: "#FF7A4A", accent: "#3FD8C8" },
];

export const COOKIE_PALETTE = "depot-palette";
export const COOKIE_MODE = "depot-mode";

export function isPalette(v: unknown): v is Palette {
  return v === "aqua" || v === "ocean" || v === "mint" || v === "sunrise";
}
export function isMode(v: unknown): v is Mode {
  return v === "light" || v === "dark";
}
