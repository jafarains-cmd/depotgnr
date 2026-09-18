import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { requireRole } from "@/lib/permissions";
import { PageHeader } from "@/components/AppShell";

export const dynamic = "force-dynamic";

const PREVIEWS = [
  {
    id: "a",
    title: "Clean & Trustworthy",
    tag: "recommended",
    tagLabel: "RECOMMENDED",
    tagColor: "bg-emerald-100 text-emerald-800",
    description:
      "Light theme, soft aqua brand, minimal animation. Vibe professional family-friendly.",
    bestFor: "Pelanggan reguler UMKM, target ibu-ibu komplek",
    features: [
      "Light background, soft shadow",
      "Border Beam subtle di button CTA",
      "Number Ticker stat pelanggan",
      "Simple grid benefits",
    ],
    previewGradient: "from-brand-soft via-white to-brand-soft",
    accentColor: "text-brand",
  },
  {
    id: "b",
    title: "Premium & Cinematic",
    tag: "premium",
    tagLabel: "PREMIUM",
    tagColor: "bg-slate-900 text-white",
    description:
      "Dark hero + Spotlight effect + Bento Grid + Marquee testimonial. Vibe high-end.",
    bestFor: "Target market kelas menengah atas, RO/imported water",
    features: [
      "Dark hero dengan Aceternity Spotlight",
      "Bento Grid benefits (varied tile size)",
      "Marquee testimonial infinite scroll",
      "Gradient text + glow effects",
    ],
    previewGradient: "from-slate-900 via-slate-950 to-cyan-950",
    accentColor: "text-cyan-400",
  },
  {
    id: "c",
    title: "Playful & Friendly",
    tag: "playful",
    tagLabel: "PLAYFUL",
    tagColor: "bg-fuchsia-100 text-fuchsia-800",
    description:
      'Colorful, emoji, chunky rounded, bounce animations. Vibe "orang biasa buat orang biasa".',
    bestFor: "Mass market Indonesia, calon pelanggan yang santai",
    features: [
      "Bright multi-color (bukan cuma aqua)",
      "Rotated cards + sticker overlay",
      "Emoji sebagai icon",
      "Hover scale + rotate untuk buttons",
    ],
    previewGradient: "from-amber-100 via-fuchsia-100 to-brand-soft",
    accentColor: "text-fuchsia-600",
  },
];

export default async function PreviewLandingIndex() {
  await requireRole(["admin"]);

  return (
    <div className="p-4 md:p-6 max-w-5xl">
      <PageHeader
        title="Preview Landing Page — 3 Direction"
        description="3 mockup landing page dengan style berbeda. Klik masing-masing untuk lihat di desktop + APK/mobile. Setelah pilih arah, kabari untuk saya implementasikan sebagai landing page real."
      />

      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 text-sm">
        <div className="font-bold text-amber-900 mb-1">⚠ Ini bukan halaman live</div>
        <p className="text-amber-800 text-xs">
          Preview cuma untuk demo desain. Content pakai placeholder (12.000+ pelanggan, testimonial dummy, dll). Setelah Anda pilih arah, saya implementasikan sebagai landing page {" "}
          <code className="bg-white px-1 rounded">/</code> dengan content real Anda.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {PREVIEWS.map((p) => (
          <Link
            key={p.id}
            href={`/admin/preview/landing/${p.id}`}
            className="group bg-surface border border-line rounded-2xl overflow-hidden hover:border-brand hover:shadow-lg transition"
          >
            {/* Mini preview visual */}
            <div
              className={`aspect-video bg-gradient-to-br ${p.previewGradient} relative overflow-hidden`}
            >
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4">
                <div className={`text-xs font-extrabold tracking-widest ${p.accentColor} uppercase`}>
                  Preview {p.id.toUpperCase()}
                </div>
                <div className="text-lg font-extrabold text-center leading-tight">
                  {p.title}
                </div>
              </div>
              <div
                className={`absolute top-2 right-2 text-[10px] font-extrabold px-2 py-0.5 rounded-full ${p.tagColor}`}
              >
                {p.tagLabel}
              </div>
            </div>

            <div className="p-4 space-y-3">
              <p className="text-xs text-[color:var(--muted)] leading-relaxed">
                {p.description}
              </p>

              <div>
                <div className="text-[11px] font-bold text-[color:var(--muted)] uppercase tracking-widest mb-1">
                  Best for
                </div>
                <p className="text-xs">{p.bestFor}</p>
              </div>

              <div>
                <div className="text-[11px] font-bold text-[color:var(--muted)] uppercase tracking-widest mb-1">
                  Fitur khas
                </div>
                <ul className="space-y-1">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-1.5 text-xs">
                      <Check size={12} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-2 border-t border-line">
                <div className="inline-flex items-center gap-1 text-brand text-sm font-bold group-hover:gap-2 transition-all">
                  Lihat preview <ArrowRight size={14} />
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-8 bg-surface border border-line rounded-2xl p-4">
        <h3 className="font-bold text-sm mb-2">💡 Tips melihat preview</h3>
        <ul className="text-xs text-[color:var(--muted)] space-y-1 list-disc pl-5">
          <li>Buka di <b>desktop browser</b> dulu untuk lihat layout wide</li>
          <li>Buka juga di <b>APK Android</b> atau resize browser ke ~400px untuk cek mobile — semua preview responsive</li>
          <li>Tab preview banner kuning di atas menghalangi sedikit — abaikan, itu cuma dev banner untuk balik ke sini</li>
          <li>Setelah pilih, saya ganti landing page real (<code className="bg-[color:var(--surface2)] px-1 rounded">/</code>) dengan direction Anda. Content bisa kita sesuaikan setelahnya (testimonial, stat real, dll)</li>
        </ul>
      </div>
    </div>
  );
}
