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
  const url = await getCfg("appsScriptUrl");
  const token = await getCfg("appsScriptToken");
  const folderId = await getCfg("driveFolderBuktiKurir");
  if (!url || !token) return { ok: false, error: "Apps Script belum diset di Pengaturan" };
  if (!folderId) return { ok: false, error: "driveFolderBuktiKurir belum diset di Pengaturan" };

  const filename = `bukti-${args.orderNomor}-${Date.now()}.${guessExt(args.mimeType)}`;

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
      }),
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
