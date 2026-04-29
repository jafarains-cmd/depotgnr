"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, Plus, History, User, LogOut, Gift } from "lucide-react";
import { authClient } from "@/lib/auth-client";

const NAV = [
  { href: "/pelanggan/beranda", label: "Beranda", icon: <Home size={20} /> },
  { href: "/pelanggan/order-baru", label: "Order", icon: <Plus size={20} /> },
  { href: "/pelanggan/riwayat", label: "Riwayat", icon: <History size={20} /> },
  { href: "/pelanggan/loyalty", label: "Loyalty", icon: <Gift size={20} /> },
  { href: "/pelanggan/profil", label: "Profil", icon: <User size={20} /> },
];

export function PelangganShell({
  userName,
  children,
}: {
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
    <div className="min-h-screen bg-slate-50 pb-20 sm:pb-0">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <div className="font-bold text-brand-700">Depot Air</div>
            <div className="text-xs text-slate-500">Halo, {userName}</div>
          </div>
          <button
            onClick={handleLogout}
            className="text-xs text-slate-600 hover:text-red-600 inline-flex items-center gap-1"
          >
            <LogOut size={14} /> Keluar
          </button>
        </div>
        {/* Desktop tabs */}
        <nav className="max-w-3xl mx-auto px-4 hidden sm:flex gap-1 border-t border-slate-100">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-2 text-sm border-b-2 transition ${
                  active
                    ? "border-brand-600 text-brand-700 font-medium"
                    : "border-transparent text-slate-600 hover:text-slate-900"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="max-w-3xl mx-auto p-4">{children}</main>
      {/* Mobile bottom nav */}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 grid grid-cols-5 z-10">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`py-2.5 flex flex-col items-center text-xs ${
                active ? "text-brand-700" : "text-slate-500"
              }`}
            >
              {item.icon}
              <span className="mt-0.5">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
