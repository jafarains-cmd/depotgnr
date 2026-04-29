import { ShoppingCart, Truck, Receipt, KeyRound } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/permissions";

const NAV = [
  { href: "/kasir/pos", label: "POS Kasir", icon: <ShoppingCart size={16} /> },
  { href: "/kasir/order", label: "Order Antar", icon: <Truck size={16} /> },
  { href: "/kasir/transaksi", label: "Riwayat Transaksi", icon: <Receipt size={16} /> },
  { href: "/akun", label: "Akun Saya", icon: <KeyRound size={16} /> },
];

export default async function KasirLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole(["admin", "kasir"]);
  return (
    <AppShell title="Kasir · Depot Air" nav={NAV} userName={session.user.name}>
      {children}
    </AppShell>
  );
}
