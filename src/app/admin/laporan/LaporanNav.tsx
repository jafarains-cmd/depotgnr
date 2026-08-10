import Link from "next/link";
import { LayoutDashboard, Receipt, Truck, Wallet, Coins, List, ArrowLeftRight, TrendingUp } from "lucide-react";

type Tab = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

const TABS: Tab[] = [
  { href: "/admin/laporan", label: "Ringkasan", icon: <LayoutDashboard size={14} /> },
  { href: "/admin/laporan/semua", label: "Semua Aktivitas", icon: <List size={14} /> },
  { href: "/admin/laporan/penjualan", label: "Penjualan", icon: <Receipt size={14} /> },
  { href: "/admin/laporan/order-antar", label: "Order Antar", icon: <Truck size={14} /> },
  { href: "/admin/laporan/cash-flow", label: "Arus Kas", icon: <ArrowLeftRight size={14} /> },
  { href: "/admin/laporan/laba", label: "Analisis Laba", icon: <TrendingUp size={14} /> },
  { href: "/admin/laporan/pengeluaran", label: "Pengeluaran", icon: <Wallet size={14} /> },
  { href: "/admin/laporan/bonus-kurir", label: "Bonus Kurir", icon: <Coins size={14} /> },
];

export function LaporanNav({ active }: { active: string }) {
  return (
    <div className="grid grid-cols-3 gap-1 md:flex md:flex-wrap no-print">
      {TABS.map((t) => {
        const isActive = active === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`px-2 py-2 md:py-1.5 rounded-md text-[11px] md:text-xs font-bold inline-flex items-center justify-center md:justify-start gap-1.5 truncate ${
              isActive
                ? "bg-brand text-white"
                : "bg-[color:var(--surface2)] text-[color:var(--muted)] hover:text-ink"
            }`}
          >
            {t.icon}
            <span className="truncate">{t.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
