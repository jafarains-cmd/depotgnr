"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/permissions";
import {
  ensureSheets,
  pushAllProduk,
  pullProdukFromSheet,
  pingAppsScript,
} from "@/lib/sheets";

export async function actionPing() {
  await requireRole(["admin"]);
  return await pingAppsScript();
}

export async function actionEnsureSheets() {
  await requireRole(["admin"]);
  return await ensureSheets();
}

export async function actionPushProduk() {
  await requireRole(["admin"]);
  return await pushAllProduk();
}

export async function actionPullProduk() {
  await requireRole(["admin"]);
  const r = await pullProdukFromSheet();
  revalidatePath("/admin/produk");
  return r;
}
