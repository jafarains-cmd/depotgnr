"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { LogOut } from "lucide-react";
import { DropFill } from "./GallonArt";

export type NavItem = { href: string; label: string; icon?: React.ReactNode };

export function AppShell({
  title,
  nav,
  userName,
  children,
}: {
  title: string;
  nav: NavItem[];
  userName: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex bg-[color:var(--surface2)]">
      <aside className="w-60 bg-surface border-r border-line flex flex-col">
        <Link href="/" className="flex items-center gap-2.5 p-5 border-b border-line">
          <span className="w-9 h-9 rounded-xl bg-brand text-white grid place-items-center">
            <DropFill size={20} color="white" />
          </span>
          <div className="min-w-0">
            <div className="font-extrabold text-[15px] tracking-tight leading-tight truncate">
              DEPOT GNR
            </div>
            <div className="text-[10px] text-[color:var(--muted)] leading-tight truncate">
              {title.replace("· Depot Air", "").trim()}
            </div>
          </div>
        </Link>
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {nav.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
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
                {item.label}
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
      <main className="flex-1 overflow-auto">{children}</main>
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
