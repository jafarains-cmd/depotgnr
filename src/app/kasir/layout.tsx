import { ShoppingCart, Truck, Receipt, KeyRound, Bike, Wallet, Users, LayoutDashboard, Coins } from "lucide-react";
import { AppShell, type NavGroup } from "@/components/AppShell";
import { requireRole } from "@/lib/permissions";
import {
  countOrderMasuk,
  countPembayaranMenunggu,
  countKurirAktif,
} from "@/lib/notifications";
import { getIdleTimeoutMenit } from "@/lib/session-config";

export default async function KasirLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole(["admin", "kasir"]);
  const [orderMasuk, pembayaran, kurirAktif, idleTimeoutMenit] = await Promise.all([
    countOrderMasuk(),
    countPembayaranMenunggu(),
    countKurirAktif(session.user.id),
    getIdleTimeoutMenit(),
  ]);

  const NAV: NavGroup[] = [
    {
      label: "Penjualan",
      items: [
        { href: "/kasir", label: "Dashboard", icon: <LayoutDashboard size={16} />, iconColor: "text-violet-600" },
        { href: "/kasir/pos", label: "POS Kasir", icon: <ShoppingCart size={16} />, iconColor: "text-brand" },
        { href: "/kasir/order", label: "Order Antar", icon: <Truck size={16} />, iconColor: "text-blue-600", badgeKey: "orderMasuk" },
        { href: "/kasir/transaksi", label: "Riwayat Transaksi", icon: <Receipt size={16} />, iconColor: "text-cyan-600" },
        { href: "/kasir/shift", label: "Shift Kasir", icon: <Coins size={16} />, iconColor: "text-amber-600" },
      ],
    },
    {
      label: "Pelanggan & Pembayaran",
      items: [
        { href: "/data-pelanggan", label: "Pelanggan", icon: <Users size={16} />, iconColor: "text-fuchsia-600" },
        { href: "/pembayaran", label: "Pembayaran", icon: <Wallet size={16} />, iconColor: "text-emerald-600", badgeKey: "pembayaran" },
        { href: "/kasir/galon-dipinjam", label: "Galon Dipinjam", icon: <Truck size={16} />, iconColor: "text-amber-600" },
      ],
    },
    {
      label: "Lainnya",
      items: [
        { href: "/kurir", label: "Mode Kurir", icon: <Bike size={16} />, iconColor: "text-indigo-600", badgeKey: "kurirAktif" },
        { href: "/akun", label: "Akun Saya", icon: <KeyRound size={16} />, iconColor: "text-gray-600" },
      ],
    },
  ];

  return (
    <AppShell
      title="Kasir · Depot Air"
      nav={NAV}
      userName={session.user.name}
      initialBadges={{ orderMasuk, pembayaran, kurirAktif }}
      idleTimeoutMenit={idleTimeoutMenit}
    >
      {children}
    </AppShell>
  );
}
