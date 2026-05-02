import { LayoutDashboard, Package, Users, Boxes, Receipt, Truck, BarChart3, Settings, UserCog, HelpCircle, Map, KeyRound, Bike, Wallet, TrendingUp, Coins } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/permissions";

const NAV = [
  { href: "/admin/dashboard", label: "Dashboard", icon: <LayoutDashboard size={16} /> },
  { href: "/admin/produk", label: "Produk", icon: <Package size={16} /> },
  { href: "/data-pelanggan", label: "Pelanggan", icon: <Users size={16} /> },
  { href: "/admin/peta", label: "Peta Pelanggan", icon: <Map size={16} /> },
  { href: "/admin/inventory", label: "Inventory", icon: <Boxes size={16} /> },
  { href: "/kasir/transaksi", label: "Transaksi", icon: <Receipt size={16} /> },
  { href: "/pembayaran", label: "Pembayaran", icon: <Wallet size={16} /> },
  { href: "/admin/bonus-kurir", label: "Bonus Kurir", icon: <Coins size={16} /> },
  { href: "/kasir/order", label: "Order Antar", icon: <Truck size={16} /> },
  { href: "/admin/laporan", label: "Laporan", icon: <BarChart3 size={16} /> },
  { href: "/admin/analitik/follow-up", label: "Follow-up", icon: <TrendingUp size={16} /> },
  { href: "/admin/users", label: "User", icon: <UserCog size={16} /> },
  { href: "/admin/pengaturan", label: "Pengaturan", icon: <Settings size={16} /> },
  { href: "/admin/bantuan", label: "Bantuan", icon: <HelpCircle size={16} /> },
  { href: "/kurir", label: "Mode Kurir", icon: <Bike size={16} /> },
  { href: "/akun", label: "Akun Saya", icon: <KeyRound size={16} /> },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole(["admin"]);
  return (
    <AppShell title="Admin · Depot Air" nav={NAV} userName={session.user.name}>
      {children}
    </AppShell>
  );
}
