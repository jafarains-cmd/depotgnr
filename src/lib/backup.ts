import { gzipSync } from "node:zlib";
import { readFileSync, statSync, unlinkSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { lt } from "drizzle-orm";
import Database from "better-sqlite3";
import { db } from "@/db";
import { backupLog } from "@/db/schema/backup";
import { pengaturan } from "@/db/schema/pengaturan";

const DB_PATH = process.env.DATABASE_URL ?? "./data/depot.db";
const RETENTION_DAYS = 30;

/**
 * Backup depot.db ke Drive folder lewat Apps Script.
 *
 * Flow:
 *  1. Buat snapshot konsisten via SQLite VACUUM INTO (online safe — tidak
 *     blokir writer aktif, hasilkan file utuh)
 *  2. Gzip → ~70-80% lebih kecil
 *  3. Upload ke Drive lewat uploadAsset (re-use infra existing)
 *  4. Insert backup_log
 *  5. Cleanup snapshot temp file
 *  6. Prune log entry > RETENTION_DAYS (file Drive tidak ikut di-delete —
 *     biar admin yang manage retention manual kalau mau)
 */
export async function runBackup(args: {
  triggeredBy: "manual" | "cron";
  triggeredByUserId?: string | null;
}): Promise<{ ok: true; logId: number; sizeBytes: number; url: string } | { error: string }> {
  const startTs = Date.now();
  const ranAt = new Date();

  // 1. Snapshot
  const snapshotPath = join(dirname(DB_PATH), `backup-${Date.now()}.db`);
  let snapshotSize = 0;
  let gzippedBase64 = "";

  try {
    const live = new Database(DB_PATH, { readonly: true });
    live.exec(`VACUUM INTO '${snapshotPath.replace(/'/g, "''")}'`);
    live.close();

    snapshotSize = statSync(snapshotPath).size;
    const buf = readFileSync(snapshotPath);
    const gz = gzipSync(buf);
    gzippedBase64 = gz.toString("base64");
  } catch (e) {
    if (existsSync(snapshotPath)) unlinkSync(snapshotPath);
    const error = e instanceof Error ? e.message : "Snapshot failed";
    await logBackup({
      ranAt,
      status: "failed",
      sizeBytes: snapshotSize,
      error,
      durationMs: Date.now() - startTs,
      triggeredBy: args.triggeredBy,
      triggeredByUserId: args.triggeredByUserId ?? null,
    });
    return { error };
  }

  // 2. Upload (use raw upload bypassing image magic-byte check via uploadAsset
  //    — tapi uploadAsset enforce image. Pakai uploadBackupFile khusus.)
  const filename = `depot-${ranAt.toISOString().replace(/[:]/g, "-")}.db.gz`;
  const up = await uploadBackupFile({
    filename,
    base64: gzippedBase64,
    mimeType: "application/gzip",
  });

  // 3. Cleanup snapshot
  if (existsSync(snapshotPath)) unlinkSync(snapshotPath);

  if (!up.ok || !up.url) {
    const error = up.error ?? "Upload failed";
    await logBackup({
      ranAt,
      status: "failed",
      sizeBytes: snapshotSize,
      error,
      durationMs: Date.now() - startTs,
      triggeredBy: args.triggeredBy,
      triggeredByUserId: args.triggeredByUserId ?? null,
    });
    return { error };
  }

  const logId = await logBackup({
    ranAt,
    status: "success",
    sizeBytes: snapshotSize,
    fileUrl: up.url,
    fileId: up.fileId ?? null,
    durationMs: Date.now() - startTs,
    triggeredBy: args.triggeredBy,
    triggeredByUserId: args.triggeredByUserId ?? null,
  });

  // 4. Prune old log entries (file di Drive dibiarkan)
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  await db.delete(backupLog).where(lt(backupLog.ranAt, cutoff));

  return { ok: true, logId, sizeBytes: snapshotSize, url: up.url };
}

async function logBackup(args: {
  ranAt: Date;
  status: "success" | "failed";
  sizeBytes?: number;
  fileUrl?: string;
  fileId?: string | null;
  error?: string;
  durationMs: number;
  triggeredBy: "manual" | "cron";
  triggeredByUserId: string | null;
}): Promise<number> {
  const [row] = await db
    .insert(backupLog)
    .values({
      ranAt: args.ranAt,
      status: args.status,
      sizeBytes: args.sizeBytes ?? null,
      fileUrl: args.fileUrl ?? null,
      fileId: args.fileId ?? null,
      error: args.error ?? null,
      durationMs: args.durationMs,
      triggeredBy: args.triggeredBy,
      triggeredByUserId: args.triggeredByUserId,
    })
    .returning({ id: backupLog.id });
  return row.id;
}

/**
 * Upload backup .db.gz ke folder Drive backup. Pakai folder driveFolderBuktiBayar
 * sebagai fallback (mayoritas user sudah set ini). Kalau user mau folder
 * dedicated, tambah `driveFolderBackup` di pengaturan.
 */
async function uploadBackupFile(args: {
  filename: string;
  base64: string;
  mimeType: string;
}): Promise<{ ok: boolean; url?: string; fileId?: string; error?: string }> {
  void pengaturan;
  const rows = await db.query.pengaturan.findMany();
  const cfg = Object.fromEntries(rows.map((r) => [r.key, r.value ?? ""]));

  const url = cfg.appsScriptUrl;
  const token = cfg.appsScriptToken;
  const folderId =
    cfg.driveFolderBackup || cfg.driveFolderBuktiBayar || cfg.driveFolderBuktiKurir;
  if (!url || !token) return { ok: false, error: "Apps Script belum diset di Pengaturan" };
  if (!folderId) return { ok: false, error: "Drive folder belum diset di Pengaturan" };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        op: "uploadFile",
        folderId,
        filename: args.filename,
        mimeType: args.mimeType,
        base64: args.base64,
      }),
      redirect: "follow",
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    return (await res.json()) as { ok: boolean; url?: string; fileId?: string };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error" };
  }
}
