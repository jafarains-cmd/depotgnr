import {
  LayoutDashboard,
  Package,
  Users,
  Boxes,
  Receipt,
  Truck,
  BarChart3,
  Settings,
  UserCog,
  HelpCircle,
  Map,
  KeyRound,
  Bike,
  Wallet,
  TrendingUp,
  Coins,
  Banknote,
  FileStack,
  Cloud,
  Wrench,
  MessageSquareWarning,
} from "lucide-react";
import { AppShell, type NavGroup } from "@/components/AppShell";
import { requireRole } from "@/lib/permissions";
import {
  countOrderMasuk,
  countPembayaranMenunggu,
  countKurirAktif,
  countKurirBonusPending,
  countKomplainBaru,
} from "@/lib/notifications";
import { countChurnRisk } from "@/lib/analytics";
import { getIdleTimeoutMenit } from "@/lib/session-config";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole(["admin"]);
  const [orderMasuk, pembayaran, kurirAktif, bonusPending, churn, komplainBaru, idleTimeoutMenit] =
    await Promise.all([
      countOrderMasuk(),
      countPembayaranMenunggu(),
      countKurirAktif(session.user.id),
      countKurirBonusPending(),
      countChurnRisk().catch(() => ({ due: 0, overdue: 0, churn: 0 })),
      countKomplainBaru(),
      getIdleTimeoutMenit(),
    ]);
  const followUp = churn.due + churn.overdue + churn.churn;

  const NAV: NavGroup[] = [
    {
      label: "Ringkasan",
      items: [
        {
          href: "/admin/dashboard",
          label: "Dashboard",
          icon: <LayoutDashboard size={16} />,
          iconColor: "text-brand",
        },
      ],
    },
    {
      label: "Operasional",
      items: [
        {
          href: "/kasir/order",
          label: "Order Antar",
          icon: <Truck size={16} />,
          iconColor: "text-blue-600",
          badgeKey: "orderMasuk",
        },
        {
          href: "/pembayaran",
          label: "Pembayaran",
          icon: <Wallet size={16} />,
          iconColor: "text-emerald-600",
          badgeKey: "pembayaran",
        },
        {
          href: "/kasir/transaksi",
          label: "Transaksi",
          icon: <Receipt size={16} />,
          iconColor: "text-cyan-600",
        },
        {
          href: "/admin/komplain",
          label: "Komplain",
          icon: <MessageSquareWarning size={16} />,
          iconColor: "text-rose-600",
          badgeKey: "komplain",
        },
        {
          href: "/kurir",
          label: "Mode Kurir",
          icon: <Bike size={16} />,
          iconColor: "text-indigo-600",
          badgeKey: "kurirAktif",
        },
      ],
    },
    {
      label: "Pelanggan",
      items: [
        {
          href: "/data-pelanggan",
          label: "Pelanggan",
          icon: <Users size={16} />,
          iconColor: "text-fuchsia-600",
        },
        {
          href: "/admin/peta",
          label: "Peta Pelanggan",
          icon: <Map size={16} />,
          iconColor: "text-violet-600",
        },
        {
          href: "/admin/analitik/follow-up",
          label: "Follow-up",
          icon: <TrendingUp size={16} />,
          iconColor: "text-pink-600",
          badgeKey: "followUp",
        },
      ],
    },
    {
      label: "Inventori",
      items: [
        {
          href: "/admin/produk",
          label: "Produk",
          icon: <Package size={16} />,
          iconColor: "text-sky-600",
        },
        {
          href: "/admin/inventory",
          label: "Inventory",
          icon: <Boxes size={16} />,
          iconColor: "text-teal-600",
        },
        {
          href: "/admin/bahan-baku",
          label: "Bahan Baku",
          icon: <Package size={16} />,
          iconColor: "text-lime-600",
        },
        {
          href: "/admin/pemeliharaan",
          label: "Pemeliharaan",
          icon: <Wrench size={16} />,
          iconColor: "text-orange-600",
        },
        {
          href: "/admin/galon-dipinjam",
          label: "Galon Dipinjam",
          icon: <Truck size={16} />,
          iconColor: "text-amber-600",
          badgeKey: "galonPinjam",
        },
      ],
    },
    {
      label: "Keuangan",
      items: [
        {
          href: "/admin/pengeluaran",
          label: "Pengeluaran",
          icon: <Banknote size={16} />,
          iconColor: "text-red-600",
        },
        {
          href: "/admin/bonus-kurir",
          label: "Bonus Kurir",
          icon: <Coins size={16} />,
          iconColor: "text-amber-600",
          badgeKey: "bonusPending",
        },
        {
          href: "/admin/bonus-staff",
          label: "Bonus Referral Staff",
          icon: <Coins size={16} />,
          iconColor: "text-emerald-600",
        },
        {
          href: "/admin/nota-gabungan",
          label: "Nota Gabungan",
          icon: <FileStack size={16} />,
          iconColor: "text-violet-600",
        },
        {
          href: "/admin/laporan",
          label: "Laporan",
          icon: <BarChart3 size={16} />,
          iconColor: "text-yellow-600",
        },
      ],
    },
    {
      label: "Sistem",
      items: [
        {
          href: "/admin/users",
          label: "User",
          icon: <UserCog size={16} />,
          iconColor: "text-slate-600",
        },
        {
          href: "/admin/backup",
          label: "Backup",
          icon: <Cloud size={16} />,
          iconColor: "text-sky-600",
        },
        {
          href: "/admin/audit-log",
          label: "Audit Log",
          icon: <FileStack size={16} />,
          iconColor: "text-purple-600",
        },
        {
          href: "/admin/shift",
          label: "Shift Kasir",
          icon: <Coins size={16} />,
          iconColor: "text-amber-600",
          badgeKey: "shiftStale",
        },
        {
          href: "/admin/pengaturan",
          label: "Pengaturan",
          icon: <Settings size={16} />,
          iconColor: "text-stone-600",
        },
        {
          href: "/admin/bantuan",
          label: "Bantuan",
          icon: <HelpCircle size={16} />,
          iconColor: "text-zinc-600",
        },
        {
          href: "/akun",
          label: "Akun Saya",
          icon: <KeyRound size={16} />,
          iconColor: "text-gray-600",
        },
      ],
    },
  ];

  return (
    <AppShell
      title="Admin · Depot Air"
      nav={NAV}
      userName={session.user.name}
      initialBadges={{
        orderMasuk,
        pembayaran,
        kurirAktif,
        bonusPending,
        followUp,
        komplain: komplainBaru,
      }}
      idleTimeoutMenit={idleTimeoutMenit}
    >
      {children}
    </AppShell>
  );
}
