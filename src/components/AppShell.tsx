"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { LogOut, Menu, X } from "lucide-react";
import { DropFill } from "./GallonArt";
import { useNotifPolling } from "./useNotifPolling";
import type { NotifCounts } from "@/lib/notif-action";

export type NavItem = {
  href: string;
  label: string;
  icon?: React.ReactNode;
  /** Badge count statis — render langsung kalau > 0. Pakai badgeKey kalau mau auto-update via polling. */
  badge?: number;
  /** Key di NotifCounts (mis. "orderMasuk") — kalau diisi, AppShell pakai polling untuk update. */
  badgeKey?: keyof NotifCounts;
};

export function AppShell({
  title,
  nav,
  userName,
  initialBadges,
  children,
}: {
  title: string;
  nav: NavItem[];
  userName: string;
  initialBadges?: NotifCounts;
  children: React.ReactNode;
}) {
  const liveBadges = useNotifPolling(initialBadges ?? {});
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Auto-close drawer when navigation happens
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  async function handleLogout() {
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  }

  const subtitle = title.replace("· Depot Air", "").trim();

  return (
    <div className="min-h-screen md:flex bg-[color:var(--surface2)]">
      {/* Mobile top bar — only visible on mobile */}
      <header className="md:hidden sticky top-0 z-30 bg-surface border-b border-line print:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <span className="w-9 h-9 rounded-xl bg-brand text-white grid place-items-center">
              <DropFill size={18} color="white" />
            </span>
            <div>
              <div className="font-extrabold text-[14px] leading-tight">DEPOT GNR</div>
              <div className="text-[10px] text-[color:var(--muted)] leading-tight">{subtitle}</div>
            </div>
          </Link>
          <button
            onClick={() => setOpen(true)}
            className="w-10 h-10 rounded-xl bg-[color:var(--surface2)] grid place-items-center"
            aria-label="Buka menu"
          >
            <Menu size={20} />
          </button>
        </div>
      </header>

      {/* Mobile drawer backdrop */}
      {open && (
        <div
          className="md:hidden fixed inset-0 bg-black/40 z-40"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      {/* Sidebar — drawer on mobile (slide-in), static on desktop */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-surface border-r border-line flex flex-col transform transition-transform md:static md:w-60 md:max-w-none md:transform-none print:hidden ${
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="flex items-center justify-between p-5 border-b border-line">
          <Link href="/" className="flex items-center gap-2.5 min-w-0">
            <span className="w-9 h-9 rounded-xl bg-brand text-white grid place-items-center flex-shrink-0">
              <DropFill size={20} color="white" />
            </span>
            <div className="min-w-0">
              <div className="font-extrabold text-[15px] tracking-tight leading-tight truncate">
                DEPOT GNR
              </div>
              <div className="text-[10px] text-[color:var(--muted)] leading-tight truncate">
                {subtitle}
              </div>
            </div>
          </Link>
          <button
            onClick={() => setOpen(false)}
            className="md:hidden w-9 h-9 rounded-lg grid place-items-center text-[color:var(--muted)] hover:bg-[color:var(--surface2)]"
            aria-label="Tutup menu"
          >
            <X size={18} />
          </button>
        </div>
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {nav.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            const liveValue = item.badgeKey ? liveBadges[item.badgeKey] : undefined;
            const badge = liveValue ?? item.badge;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition ${
                  active
                    ? "bg-brand-soft text-brand font-bold"
                    : "text-[color:var(--ink2)] hover:bg-[color:var(--surface2)]"
                }`}
              >
                {item.icon}
                <span className="flex-1">{item.label}</span>
                {badge !== undefined && badge > 0 && (
                  <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-full bg-rose-500 text-white min-w-[18px] text-center leading-none flex-shrink-0">
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-line">
          <div className="px-2 py-2 mb-2 rounded-xl bg-[color:var(--surface2)]">
            <div className="text-[10px] text-[color:var(--muted)] font-semibold uppercase tracking-wide">
              Login sebagai
            </div>
            <div className="text-xs font-bold truncate">{userName}</div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-[color:var(--muted)] hover:text-[color:var(--accent2)] rounded-lg hover:bg-[color:var(--surface2)] transition"
          >
            <LogOut size={14} /> Keluar
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto min-w-0">{children}</main>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between mb-6 gap-3 flex-wrap">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        {description && (
          <p className="text-sm text-[color:var(--muted)] mt-0.5">{description}</p>
        )}
      </div>
      <div className="flex gap-2">{actions}</div>
    </div>
  );
}
