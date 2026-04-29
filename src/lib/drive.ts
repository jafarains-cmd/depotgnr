import { eq } from "drizzle-orm";
import { db } from "@/db";
import { pengaturan } from "@/db/schema/pengaturan";

async function getCfg(key: string): Promise<string> {
  const row = await db.query.pengaturan.findFirst({ where: eq(pengaturan.key, key) });
  return row?.value ?? "";
}

type UploadResp = {
  ok: boolean;
  url?: string;
  fileId?: string;
  error?: string;
};

export async function uploadBuktiKurir(args: {
  orderNomor: string;
  base64: string;
  mimeType: string;
}): Promise<UploadResp> {
  return await uploadToDrive({
    folderKey: "driveFolderBuktiKurir",
    prefix: "bukti-antar",
    refId: args.orderNomor,
    base64: args.base64,
    mimeType: args.mimeType,
  });
}

export async function uploadBuktiBayar(args: {
  orderNomor: string;
  base64: string;
  mimeType: string;
}): Promise<UploadResp> {
  return await uploadToDrive({
    folderKey: "driveFolderBuktiBayar",
    fallbackFolderKey: "driveFolderBuktiKurir",
    prefix: "bukti-bayar",
    refId: args.orderNomor,
    base64: args.base64,
    mimeType: args.mimeType,
  });
}

export async function uploadAsset(args: {
  prefix: string;
  base64: string;
  mimeType: string;
}): Promise<UploadResp> {
  // Reuse folder bukti bayar (atau bukti kurir sebagai fallback) untuk simpan asset depot (QRIS, dll)
  return await uploadToDrive({
    folderKey: "driveFolderBuktiBayar",
    fallbackFolderKey: "driveFolderBuktiKurir",
    prefix: args.prefix,
    refId: "asset",
    base64: args.base64,
    mimeType: args.mimeType,
  });
}

async function uploadToDrive(args: {
  folderKey: string;
  fallbackFolderKey?: string;
  prefix: string;
  refId: string;
  base64: string;
  mimeType: string;
}): Promise<UploadResp> {
  const url = await getCfg("appsScriptUrl");
  const token = await getCfg("appsScriptToken");
  let folderId = await getCfg(args.folderKey);
  if (!folderId && args.fallbackFolderKey) {
    folderId = await getCfg(args.fallbackFolderKey);
  }
  if (!url || !token) return { ok: false, error: "Apps Script belum diset di Pengaturan" };
  if (!folderId) return { ok: false, error: `${args.folderKey} belum diset di Pengaturan` };

  const filename = `${args.prefix}-${args.refId}-${Date.now()}.${guessExt(args.mimeType)}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        op: "uploadFile",
        folderId,
        filename,
        mimeType: args.mimeType,
        base64: args.base64,
      }) ,
      redirect: "follow",
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    return (await res.json()) as UploadResp;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error" };
  }
}

function guessExt(mime: string): string {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  return "jpg";
}
