import { PageHeader } from "@/components/AppShell";
import { requireRole } from "@/lib/permissions";
import { getPrediksiPelanggan } from "@/lib/analytics";
import { FollowUpClient } from "./FollowUpClient";

export const dynamic = "force-dynamic";

export default async function FollowUpPage() {
  await requireRole(["admin", "kasir"]);
  const list = await getPrediksiPelanggan();

  // Sort: churn-risk dulu, lalu overdue, lalu due
  const order = { "churn-risk": 0, overdue: 1, due: 2, "not-due": 3 };
  list.sort((a, b) => {
    const o = order[a.status] - order[b.status];
    if (o !== 0) return o;
    return b.daysOverdue - a.daysOverdue;
  });

  return (
    <div className="p-4 md:p-6 max-w-5xl">
      <PageHeader
        title="Analitik · Follow-up Pelanggan"
        description="Pelanggan yang prediksi order-nya hari ini ± 2 hari, atau sudah lewat dari pola biasanya. Kirim reminder WA otomatis."
      />
      <FollowUpClient
        rows={list.map((r) => ({
          ...r,
          lastOrderAt: r.lastOrderAt.toISOString(),
          predictedNext: r.predictedNext.toISOString(),
        }))}
      />
    </div>
  );
}
