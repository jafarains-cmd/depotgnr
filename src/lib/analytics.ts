import { eq, and, ne, asc, desc, isNotNull, gte } from "drizzle-orm";
import { db } from "@/db";
import { orderHeader } from "@/db/schema/order";
import { pelanggan as pelangganTable } from "@/db/schema/pelanggan";

const DAY_MS = 24 * 60 * 60 * 1000;

export type PrediksiPelanggan = {
  pelangganId: number;
  nama: string;
  telp: string | null;
  userId: string | null;
  totalOrder: number;
  lastOrderAt: Date;
  avgIntervalDays: number;
  stdDevDays: number;
  predictedNext: Date;
  daysSinceLastOrder: number;
  daysOverdue: number; // negatif kalau belum due, positif kalau sudah lewat prediksi
  zScore: number; // berapa std dev di atas rata-rata
  status: "due" | "overdue" | "churn-risk" | "not-due";
};

/**
 * Hitung prediksi order berikutnya untuk semua pelanggan yang punya minimal 2 order
 * dengan status selesai. Return list lengkap (bisa difilter di caller).
 */
export async function getPrediksiPelanggan(): Promise<PrediksiPelanggan[]> {
  const pelangganList = await db
    .select({
      id: pelangganTable.id,
      nama: pelangganTable.nama,
      telp: pelangganTable.telp,
      userId: pelangganTable.userId,
    })
    .from(pelangganTable);

  const out: PrediksiPelanggan[] = [];
  const now = Date.now();

  for (const p of pelangganList) {
    const orders = await db
      .select({ createdAt: orderHeader.createdAt })
      .from(orderHeader)
      .where(
        and(
          eq(orderHeader.pelangganId, p.id),
          ne(orderHeader.status, "batal"),
        ),
      )
      .orderBy(asc(orderHeader.createdAt));

    if (orders.length < 2) continue;

    // Hitung interval (hari) antar order
    const intervals: number[] = [];
    for (let i = 1; i < orders.length; i++) {
      const diffMs = orders[i].createdAt.getTime() - orders[i - 1].createdAt.getTime();
      const diffDays = diffMs / DAY_MS;
      if (diffDays > 0) intervals.push(diffDays);
    }
    if (intervals.length === 0) continue;

    const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((s, x) => s + (x - avg) ** 2, 0) / intervals.length;
    const stdDev = Math.sqrt(variance);

    const lastOrder = orders[orders.length - 1].createdAt;
    const predictedNext = new Date(lastOrder.getTime() + avg * DAY_MS);
    const daysSinceLast = (now - lastOrder.getTime()) / DAY_MS;
    const daysOverdue = daysSinceLast - avg;
    const zScore = stdDev > 0 ? daysOverdue / stdDev : 0;

    let status: PrediksiPelanggan["status"];
    if (Math.abs(daysOverdue) <= 2) status = "due";
    else if (zScore > 2) status = "churn-risk";
    else if (daysOverdue > 0) status = "overdue";
    else status = "not-due";

    out.push({
      pelangganId: p.id,
      nama: p.nama,
      telp: p.telp,
      userId: p.userId,
      totalOrder: orders.length,
      lastOrderAt: lastOrder,
      avgIntervalDays: Math.round(avg * 10) / 10,
      stdDevDays: Math.round(stdDev * 10) / 10,
      predictedNext,
      daysSinceLastOrder: Math.round(daysSinceLast * 10) / 10,
      daysOverdue: Math.round(daysOverdue * 10) / 10,
      zScore: Math.round(zScore * 10) / 10,
      status,
    });
  }

  return out;
}

/**
 * Quick count untuk widget dashboard.
 */
export async function countChurnRisk(): Promise<{ due: number; overdue: number; churn: number }> {
  const list = await getPrediksiPelanggan();
  return {
    due: list.filter((x) => x.status === "due").length,
    overdue: list.filter((x) => x.status === "overdue").length,
    churn: list.filter((x) => x.status === "churn-risk").length,
  };
}
