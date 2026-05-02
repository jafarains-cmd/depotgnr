import { ShoppingCart, Truck, Receipt, KeyRound, Bike, Wallet, Users } from "lucide-react";
import { AppShell, type NavItem } from "@/components/AppShell";
import { requireRole } from "@/lib/permissions";
import {
  countOrderMasuk,
  countPembayaranMenunggu,
  countKurirAktif,
} from "@/lib/notifications";

export default async function KasirLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole(["admin", "kasir"]);
  const [orderMasuk, pembayaran, kurirAktif] = await Promise.all([
    countOrderMasuk(),
    countPembayaranMenunggu(),
    countKurirAktif(session.user.id),
  ]);

  const NAV: NavItem[] = [
    { href: "/kasir/pos", label: "POS Kasir", icon: <ShoppingCart size={16} /> },
    { href: "/kasir/order", label: "Order Antar", icon: <Truck size={16} />, badge: orderMasuk },
    { href: "/kasir/transaksi", label: "Riwayat Transaksi", icon: <Receipt size={16} /> },
    { href: "/data-pelanggan", label: "Pelanggan", icon: <Users size={16} /> },
    { href: "/pembayaran", label: "Pembayaran", icon: <Wallet size={16} />, badge: pembayaran },
    { href: "/kurir", label: "Mode Kurir", icon: <Bike size={16} />, badge: kurirAktif },
    { href: "/akun", label: "Akun Saya", icon: <KeyRound size={16} /> },
  ];

  return (
    <AppShell title="Kasir · Depot Air" nav={NAV} userName={session.user.name}>
      {children}
    </AppShell>
  );
}
