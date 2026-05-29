"use client";

import { useState, useTransition } from "react";
import { Search, Loader2, MapPin } from "lucide-react";

type Hit = {
  display_name: string;
  lat: string;
  lon: string;
  type?: string;
};

export function LocationSearchBox({
  onPick,
}: {
  onPick: (lat: number, lng: number, label: string) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Hit[]>([]);
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function doSearch() {
    const term = q.trim();
    if (term.length < 3) {
      setErr("Minimal 3 karakter");
      return;
    }
    setErr(null);
    startTransition(async () => {
      try {
        // Nominatim OSM — gratis, rate-limited 1 req/s. Tambah "Indonesia" supaya
        // hasil bias ke ID.
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
          term + " Indonesia",
        )}&format=json&limit=8&addressdetails=0`;
        const r = await fetch(url, {
          headers: { "Accept-Language": "id" },
        });
        if (!r.ok) {
          setErr("Pencarian gagal. Coba lagi.");
          return;
        }
        const data = (await r.json()) as Hit[];
        setResults(data);
        if (data.length === 0) setErr("Tidak ditemukan. Coba kata kunci lain.");
      } catch {
        setErr("Gagal koneksi ke layanan pencarian.");
      }
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              doSearch();
            }
          }}
          placeholder="Cari alamat / nama tempat / landmark..."
          className="flex-1 px-3 py-2 border border-line rounded-md text-sm bg-surface"
        />
        <button
          type="button"
          onClick={doSearch}
          disabled={pending || q.trim().length < 3}
          className="px-3 py-2 bg-brand-600 text-white rounded-md text-xs font-bold inline-flex items-center gap-1 disabled:opacity-50"
        >
          {pending ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          Cari
        </button>
      </div>
      {err && <p className="text-xs text-rose-600">{err}</p>}
      {results.length > 0 && (
        <div className="max-h-40 overflow-y-auto bg-surface border border-line rounded-md divide-y divide-line">
          {results.map((h, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                onPick(Number(h.lat), Number(h.lon), h.display_name);
                setResults([]);
                setQ("");
              }}
              className="w-full text-left p-2 hover:bg-[color:var(--surface2)] text-xs inline-flex items-start gap-2"
            >
              <MapPin size={12} className="mt-0.5 flex-shrink-0 text-brand" />
              <span className="line-clamp-2">{h.display_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
