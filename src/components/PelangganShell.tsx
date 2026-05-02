"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, Plus, History, User, LogOut, Gift } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { DropFill } from "./GallonArt";

type NavBadges = {
  pesanan?: number;
};

const NAV = [
  { href: "/pelanggan/beranda", label: "Beranda", icon: <Home size={20} />, badgeKey: undefined },
  { href: "/pelanggan/order-baru", label: "Pesan", icon: <Plus size={20} />, badgeKey: undefined },
  {
    href: "/pelanggan/riwayat",
    label: "Pesanan",
    icon: <History size={20} />,
    badgeKey: "pesanan" as const,
  },
  { href: "/pelanggan/loyalty", label: "Reward", icon: <Gift size={20} />, badgeKey: undefined },
  { href: "/pelanggan/profil", label: "Profil", icon: <User size={20} />, badgeKey: undefined },
];

function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-rose-500 text-white min-w-[16px] text-center leading-none">
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function PelangganShell({
  userName,
  badges,
  children,
}: {
  userName: string;
  badges?: NavBadges;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  }

  // Halaman beranda pakai full-bleed (header sendiri)
  const isBeranda = pathname === "/pelanggan/beranda";

  function getBadge(key: typeof NAV[number]["badgeKey"]): number {
    if (!key || !badges) return 0;
    return badges[key] ?? 0;
  }

  return (
    <div className="min-h-screen bg-[color:var(--surface2)] pb-24 sm:pb-0">
      {!isBeranda && (
        <header className="bg-surface border-b border-line sticky top-0 z-10">
          <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link href="/pelanggan/beranda" className="inline-flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-brand text-white grid place-items-center">
                <DropFill size={18} color="white" />
              </span>
              <div>
                <div className="font-bold text-ink leading-tight">DEPOT GNR</div>
                <div className="text-[10px] text-[color:var(--muted)] leading-tight">
                  Halo, {userName}
                </div>
              </div>
            </Link>
            <button
              onClick={handleLogout}
              className="text-xs text-[color:var(--muted)] hover:text-[color:var(--accent2)] inline-flex items-center gap-1"
            >
              <LogOut size={14} /> Keluar
            </button>
          </div>
          <nav className="max-w-3xl mx-auto px-4 hidden sm:flex gap-1 border-t border-line">
            {NAV.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(item.href + "/");
              const badge = getBadge(item.badgeKey);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-2 text-sm border-b-2 transition inline-flex items-center gap-1.5 ${
                    active
                      ? "border-brand text-brand font-semibold"
                      : "border-transparent text-[color:var(--muted)] hover:text-ink"
                  }`}
                >
                  {item.label}
                  <Badge count={badge} />
                </Link>
              );
            })}
          </nav>
        </header>
      )}

      <main className={isBeranda ? "" : "max-w-3xl mx-auto p-4"}>{children}</main>

      {/* Mobile bottom nav */}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 bg-surface border-t border-line grid grid-cols-5 z-20">
        {NAV.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const badge = getBadge(item.badgeKey);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`py-2.5 flex flex-col items-center text-[10px] transition relative ${
                active ? "text-brand font-semibold" : "text-[color:var(--muted)]"
              }`}
            >
              {item.icon}
              <span className="mt-0.5">{item.label}</span>
              {badge > 0 && (
                <span className="absolute top-1 right-[20%] text-[9px] font-extrabold px-1 py-0 rounded-full bg-rose-500 text-white min-w-[14px] text-center leading-tight">
                  {badge > 9 ? "9+" : badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
