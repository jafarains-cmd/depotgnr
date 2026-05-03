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
    allowPdf: true,
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

// Max upload size 5MB (rough — base64 string overhead ~4/3, jadi ~6.7MB string).
const MAX_BASE64_LENGTH = 7 * 1024 * 1024;

/**
 * Validasi magic bytes — cegah upload non-image.
 * JPEG: FF D8 FF · PNG: 89 50 4E 47 · WEBP: RIFF ...... WEBP · GIF: GIF8
 * Decode 16 byte awal dari base64 saja.
 */
function validateUploadMagicBytes(
  base64: string,
  allowPdf: boolean,
): { ok: true; type: string } | { ok: false; error: string } {
  try {
    const head = Buffer.from(base64.slice(0, 24), "base64");
    if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return { ok: true, type: "jpeg" };
    if (head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) return { ok: true, type: "png" };
    if (
      head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46 && // RIFF
      head[8] === 0x57 && head[9] === 0x45 && head[10] === 0x42 && head[11] === 0x50  // WEBP
    ) return { ok: true, type: "webp" };
    if (head[0] === 0x47 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x38) return { ok: true, type: "gif" };
    if (
      allowPdf &&
      head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46 // %PDF
    ) return { ok: true, type: "pdf" };
    const allowed = allowPdf ? "JPEG/PNG/WebP/GIF/PDF" : "JPEG/PNG/WebP/GIF";
    return { ok: false, error: `File bukan ${allowed} yang valid` };
  } catch {
    return { ok: false, error: "Gagal decode file" };
  }
}

async function uploadToDrive(args: {
  folderKey: string;
  fallbackFolderKey?: string;
  prefix: string;
  refId: string;
  base64: string;
  mimeType: string;
  allowPdf?: boolean;
}): Promise<UploadResp> {
  // Size guard
  if (args.base64.length > MAX_BASE64_LENGTH) {
    return { ok: false, error: "File terlalu besar (max ~5MB)" };
  }
  // Magic byte validation
  const v = validateUploadMagicBytes(args.base64, args.allowPdf ?? false);
  if (!v.ok) return { ok: false, error: v.error };

  const url = await getCfg("appsScriptUrl");
  const token = await getCfg("appsScriptToken");
  let folderId = await getCfg(args.folderKey);
  if (!folderId && args.fallbackFolderKey) {
    folderId = await getCfg(args.fallbackFolderKey);
  }
  if (!url || !token) return { ok: false, error: "Apps Script belum diset di Pengaturan" };
  if (!folderId) return { ok: false, error: `${args.folderKey} belum diset di Pengaturan` };

  // Trust mime detected dari magic bytes
  const mimeType = v.type === "pdf" ? "application/pdf" : `image/${v.type}`;
  const filename = `${args.prefix}-${args.refId}-${Date.now()}.${guessExt(mimeType)}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        op: "uploadFile",
        folderId,
        filename,
        mimeType,
        base64: args.base64,
      }),
      redirect: "follow",
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const json = (await res.json()) as UploadResp;
    // Marker untuk PDF supaya display layer tahu render link, bukan <img>
    if (json.ok && json.url && v.type === "pdf") {
      return { ...json, url: `${json.url}#mime=pdf` };
    }
    return json;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error" };
  }
}

function guessExt(mime: string): string {
  if (mime.includes("pdf")) return "pdf";
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  return "jpg";
}
