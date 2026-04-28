import { db } from "@/db";
import { transaksi } from "@/db/schema/transaksi";
import { orderHeader } from "@/db/schema/order";
import { stokGalon } from "@/db/schema/inventory";
import { user as userTable } from "@/db/schema/auth";
import { sql, gte, eq } from "drizzle-orm";
import { formatRupiah } from "@/lib/utils";
import { PageHeader } from "@/components/AppShell";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [omzetRow] = await db
    .select({ total: sql<number>`coalesce(sum(${transaksi.total}), 0)` })
    .from(transaksi)
    .where(gte(transaksi.createdAt, startOfDay));

  const [orderPendingRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(orderHeader)
    .where(eq(orderHeader.status, "pending"));

  const stokTerisi = await db
    .select({ total: sql<number>`coalesce(sum(${stokGalon.jumlah}), 0)` })
    .from(stokGalon)
    .where(eq(stokGalon.status, "terisi"));

  const [usersRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(userTable);

  const cards = [
    { label: "Omzet Hari Ini", value: formatRupiah(omzetRow.total), color: "bg-emerald-50 text-emerald-700" },
    { label: "Order Pending", value: orderPendingRow.count.toString(), color: "bg-amber-50 text-amber-700" },
    { label: "Galon Terisi", value: stokTerisi[0]?.total.toString() ?? "0", color: "bg-blue-50 text-blue-700" },
    { label: "Total User", value: usersRow.count.toString(), color: "bg-slate-100 text-slate-700" },
  ];

  return (
    <div className="p-6">
      <PageHeader title="Dashboard" description="Ringkasan operasional depot hari ini." />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className={`rounded-xl p-5 border border-slate-200 ${c.color}`}>
            <div className="text-sm font-medium opacity-80">{c.label}</div>
            <div className="text-2xl font-bold mt-1">{c.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
