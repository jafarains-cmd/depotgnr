"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, ExternalLink, Sparkles } from "lucide-react";

/**
 * Numbered section (existing style — dipakai di SetupTeknisContent).
 * Server-rendered friendly.
 */
export function Section({
  id,
  title,
  summary,
  children,
}: {
  id: string;
  title: string;
  summary?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="bg-surface border border-line rounded-2xl p-5 scroll-mt-4">
      <h2 className="text-lg font-bold text-ink">{title}</h2>
      {summary && <p className="text-sm text-[color:var(--muted)] mb-4">{summary}</p>}
      <div className="space-y-4">{children}</div>
    </section>
  );
}

/**
 * Numbered step. Server-rendered.
 */
export function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-brand-100 text-brand-700 font-semibold text-sm flex items-center justify-center">
        {n}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-ink mb-1.5">{title}</div>
        {children}
      </div>
    </div>
  );
}

/**
 * Collapsible guide section — modern accordion style dengan icon.
 * Client-side toggle. Default: closed.
 */
export function GuideSection({
  icon,
  title,
  description,
  badge,
  openUrl,
  openLabel = "Buka halaman ini",
  defaultOpen = false,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  badge?: "Baru" | "Beta";
  openUrl?: string;
  openLabel?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="bg-surface border border-line rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-[color:var(--surface2)] transition"
      >
        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-brand-soft text-brand grid place-items-center">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-ink">{title}</h3>
            {badge && (
              <span
                className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider inline-flex items-center gap-0.5 ${
                  badge === "Baru"
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                <Sparkles size={9} /> {badge}
              </span>
            )}
          </div>
          {description && (
            <p className="text-xs text-[color:var(--muted)] mt-0.5 line-clamp-2">
              {description}
            </p>
          )}
        </div>
        {open ? (
          <ChevronDown size={18} className="text-[color:var(--muted)] flex-shrink-0" />
        ) : (
          <ChevronRight size={18} className="text-[color:var(--muted)] flex-shrink-0" />
        )}
      </button>

      {open && (
        <div className="border-t border-line px-4 pt-3 pb-4">
          <div className="prose prose-sm max-w-none text-sm text-ink space-y-3 [&_p]:my-2 [&_ul]:my-2 [&_li]:my-0.5 [&_ol]:my-2 [&_code]:bg-[color:var(--surface2)] [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[12px] [&_kbd]:bg-slate-200 [&_kbd]:px-1.5 [&_kbd]:py-0.5 [&_kbd]:rounded [&_kbd]:text-[11px] [&_kbd]:font-mono [&_kbd]:border [&_kbd]:border-slate-300 [&_kbd]:shadow-sm [&_strong]:font-bold">
            {children}
            {openUrl && (
              <div className="mt-3 pt-3 border-t border-line">
                <Link
                  href={openUrl}
                  className="inline-flex items-center gap-1 text-sm text-brand font-bold hover:underline"
                >
                  {openLabel} <ExternalLink size={14} />
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Group divider dengan label + optional badge count.
 */
export function GuideGroup({
  label,
  count,
  children,
}: {
  label: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-1 pt-2">
        <h2 className="text-[11px] font-extrabold tracking-widest text-[color:var(--muted)] uppercase">
          {label}
        </h2>
        {count !== undefined && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[color:var(--surface2)] text-[color:var(--muted)]">
            {count}
          </span>
        )}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
