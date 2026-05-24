import Link from "next/link";
import { LayoutDashboard, Receipt, Truck, Wallet, Coins, List } from "lucide-react";

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
  { href: "/admin/laporan/pengeluaran", label: "Pengeluaran", icon: <Wallet size={14} /> },
  { href: "/admin/laporan/bonus-kurir", label: "Bonus Kurir", icon: <Coins size={14} /> },
];

export function LaporanNav({ active }: { active: string }) {
  return (
    <div className="flex gap-1 overflow-x-auto -mx-1 px-1 no-print">
      {TABS.map((t) => {
        const isActive = active === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`whitespace-nowrap px-3 py-1.5 rounded-md text-xs font-bold inline-flex items-center gap-1.5 ${
              isActive
                ? "bg-brand text-white"
                : "bg-[color:var(--surface2)] text-[color:var(--muted)] hover:text-ink"
            }`}
          >
            {t.icon} {t.label}
          </Link>
        );
      })}
    </div>
  );
}
