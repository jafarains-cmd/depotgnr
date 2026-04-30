"use client";

import { useState, useEffect } from "react";
import { Moon, Sun, Palette as PaletteIcon } from "lucide-react";
import { PALETTES, COOKIE_PALETTE, COOKIE_MODE, type Palette, type Mode, isPalette, isMode } from "@/lib/theme";

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${value}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
}

export function ThemeSwitcher() {
  const [palette, setPaletteState] = useState<Palette>("aqua");
  const [mode, setModeState] = useState<Mode>("light");

  useEffect(() => {
    const html = document.documentElement;
    const p = html.getAttribute("data-palette");
    const m = html.getAttribute("data-mode");
    if (isPalette(p)) setPaletteState(p);
    if (isMode(m)) setModeState(m);
  }, []);

  function applyPalette(p: Palette) {
    setPaletteState(p);
    document.documentElement.setAttribute("data-palette", p);
    setCookie(COOKIE_PALETTE, p);
  }
  function applyMode(m: Mode) {
    setModeState(m);
    document.documentElement.setAttribute("data-mode", m);
    setCookie(COOKIE_MODE, m);
  }

  return (
    <div className="bg-surface border border-line rounded-2xl p-4 space-y-4">
      <div>
        <h3 className="font-semibold text-sm inline-flex items-center gap-1.5">
          <PaletteIcon size={14} /> Tema Warna
        </h3>
        <p className="text-xs text-[color:var(--muted)] mt-0.5">Pilih palet sesuai selera Anda.</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {PALETTES.map((p) => (
          <button
            key={p.id}
            onClick={() => applyPalette(p.id)}
            className={`p-3 rounded-xl border-2 text-left transition ${
              palette === p.id
                ? "border-brand bg-brand-soft"
                : "border-line bg-surface hover:border-[color:var(--ink2)]"
            }`}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <span
                className="w-5 h-5 rounded-full border border-line"
                style={{ background: p.brand }}
              />
              <span
                className="w-5 h-5 rounded-full border border-line"
                style={{ background: p.accent }}
              />
            </div>
            <div className="text-xs font-semibold">{p.name}</div>
          </button>
        ))}
      </div>

      <div className="border-t border-line pt-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold inline-flex items-center gap-1.5">
              {mode === "dark" ? <Moon size={14} /> : <Sun size={14} />}
              Mode {mode === "dark" ? "Gelap" : "Terang"}
            </div>
            <div className="text-xs text-[color:var(--muted)] mt-0.5">
              Otomatis tersimpan di browser ini.
            </div>
          </div>
          <button
            onClick={() => applyMode(mode === "dark" ? "light" : "dark")}
            className="relative w-12 h-7 rounded-full bg-line transition"
            style={{
              backgroundColor:
                mode === "dark" ? "var(--brand)" : "var(--line)",
            }}
          >
            <span
              className="absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-all"
              style={{ left: mode === "dark" ? "22px" : "2px" }}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
