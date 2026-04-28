import { eq } from "drizzle-orm";
import { db } from "@/db";
import { transaksi } from "@/db/schema/transaksi";
import { orderHeader } from "@/db/schema/order";
import { produk } from "@/db/schema/produk";
import { pengaturan } from "@/db/schema/pengaturan";

/**
 * Bridge ke Google Sheets via Apps Script Web App.
 * Tidak butuh service account — user pasang script di sheet-nya sendiri,
 * deploy sebagai Web App, lalu paste URL + token ke /admin/pengaturan.
 *
 * Lihat docs/apps-script.gs untuk kode yang harus dipasang.
 */

const TAB_TRANSAKSI = "Transaksi";
const TAB_ORDER = "Order";
const TAB_PRODUK = "Produk";

async function getCfg(key: string): Promise<string> {
  const row = await db.query.pengaturan.findFirst({ where: eq(pengaturan.key, key) });
  return row?.value ?? "";
}

type AppsScriptResp = {
  ok: boolean;
  error?: string;
  msg?: string;
  count?: number;
  rows?: unknown[][];
};

async function callAppsScript(payload: Record<string, unknown>): Promise<AppsScriptResp> {
  const url = await getCfg("appsScriptUrl");
  const token = await getCfg("appsScriptToken");
  if (!url) return { ok: false, error: "Apps Script URL belum diset di Pengaturan" };
  if (!token) return { ok: false, error: "Apps Script Token belum diset di Pengaturan" };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, ...payload }),
      redirect: "follow",
    });
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}: ${await res.text()}` };
    }
    return (await res.json()) as AppsScriptResp;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error" };
  }
}

export async function pingAppsScript(): Promise<{ ok: boolean; error?: string; msg?: string }> {
  return await callAppsScript({ op: "ping" });
}

export async function ensureSheets(): Promise<{ ok: boolean; error?: string }> {
  return await callAppsScript({ op: "ensure" });
}

export async function pushTransaksi(trxId: number): Promise<void> {
  const t = await db.query.transaksi.findFirst({ where: eq(transaksi.id, trxId) });
  if (!t) return;
  const r = await callAppsScript({
    op: "append",
    tab: TAB_TRANSAKSI,
    values: [
      t.id,
      t.nomorNota,
      t.kasirUserId ?? "",
      t.pelangganId ?? "",
      t.subtotal,
      t.diskon,
      t.total,
      t.metodeBayar,
      t.status,
      t.catatan ?? "",
      t.createdAt.toISOString(),
    ],
  });
  if (r.ok) {
    await db
      .update(transaksi)
      .set({ lastSyncedAt: new Date() })
      .where(eq(transaksi.id, trxId));
  }
}

export async function pushOrder(orderId: number): Promise<void> {
  const o = await db.query.orderHeader.findFirst({ where: eq(orderHeader.id, orderId) });
  if (!o) return;
  const r = await callAppsScript({
    op: "append",
    tab: TAB_ORDER,
    values: [
      o.id,
      o.nomorOrder,
      o.pelangganId ?? "",
      o.sumber,
      o.alamatAntar ?? "",
      o.status,
      o.totalEstimasi,
      o.catatan ?? "",
      o.createdAt.toISOString(),
      o.updatedAt.toISOString(),
    ],
  });
  if (r.ok) {
    await db
      .update(orderHeader)
      .set({ lastSyncedAt: new Date() })
      .where(eq(orderHeader.id, orderId));
  }
}

export async function pushAllProduk(): Promise<{ ok: boolean; count: number; error?: string }> {
  const list = await db.query.produk.findMany({ orderBy: (p, { asc }) => [asc(p.id)] });
  const rows = list.map((p) => [
    p.id,
    p.nama,
    p.deskripsi ?? "",
    p.hargaIsiUlang,
    p.hargaTukar,
    p.hargaBeliBaru,
    p.aktif ? "TRUE" : "FALSE",
  ]);
  const r = await callAppsScript({ op: "replace", tab: TAB_PRODUK, rows });
  return { ok: r.ok, count: r.count ?? rows.length, error: r.error };
}

export async function pullProdukFromSheet(): Promise<{
  ok: boolean;
  updated: number;
  error?: string;
}> {
  const r = await callAppsScript({ op: "read", tab: TAB_PRODUK });
  if (!r.ok || !r.rows) return { ok: false, updated: 0, error: r.error ?? "Gagal baca sheet" };

  let updated = 0;
  for (const row of r.rows) {
    const id = Number(row[0]);
    if (!id) continue;
    const data = {
      nama: String(row[1] ?? "").trim(),
      deskripsi: row[2] ? String(row[2]) : null,
      hargaIsiUlang: Number(row[3] ?? 0),
      hargaTukar: Number(row[4] ?? 0),
      hargaBeliBaru: Number(row[5] ?? 0),
      aktif: String(row[6] ?? "TRUE").toUpperCase() === "TRUE",
      updatedAt: new Date(),
    };
    if (!data.nama) continue;
    await db.update(produk).set(data).where(eq(produk.id, id));
    updated += 1;
  }
  return { ok: true, updated };
}
