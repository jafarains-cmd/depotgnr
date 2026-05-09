import { desc, eq } from "drizzle-orm";
import { ExternalLink, CheckCircle, XCircle } from "lucide-react";
import { db } from "@/db";
import { backupLog } from "@/db/schema/backup";
import { user as userTable } from "@/db/schema/auth";
import { PageHeader } from "@/components/AppShell";
import { requireRole } from "@/lib/permissions";
import { formatRupiah } from "@/lib/utils";
import { BackupActions } from "./BackupActions";

export const dynamic = "force-dynamic";

function formatBytes(b: number | null): string {
  if (!b) return "-";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
}

function formatDuration(ms: number | null): string {
  if (!ms) return "-";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default async function BackupPage() {
  await requireRole(["admin"]);

  const rows = await db
    .select({
      id: backupLog.id,
      ranAt: backupLog.ranAt,
      status: backupLog.status,
      sizeBytes: backupLog.sizeBytes,
      fileUrl: backupLog.fileUrl,
      durationMs: backupLog.durationMs,
      triggeredBy: backupLog.triggeredBy,
      error: backupLog.error,
      userName: userTable.name,
    })
    .from(backupLog)
    .leftJoin(userTable, eq(backupLog.triggeredByUserId, userTable.id))
    .orderBy(desc(backupLog.ranAt))
    .limit(50);

  const lastSuccess = rows.find((r) => r.status === "success");
  const totalSuccess = rows.filter((r) => r.status === "success").length;
  void formatRupiah;

  return (
    <div className="p-4 md:p-6 max-w-4xl space-y-4">
      <PageHeader
        title="Backup Database"
        description="Snapshot harian database depot ke Google Drive. Retention 30 hari di log."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
          <div className="text-[10px] font-bold tracking-widest text-emerald-700">
            BACKUP TERAKHIR (BERHASIL)
          </div>
          <div className="text-base font-extrabold text-emerald-900 mt-1">
            {lastSuccess
              ? lastSuccess.ranAt.toLocaleString("id-ID", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })
              : "Belum ada"}
          </div>
          {lastSuccess && (
            <div className="text-[11px] text-emerald-700 mt-1">
              Ukuran: {formatBytes(lastSuccess.sizeBytes)}
            </div>
          )}
        </div>
        <div className="bg-surface border border-line rounded-2xl p-4">
          <div className="text-[10px] font-bold tracking-widest text-[color:var(--muted)]">
            TOTAL SUKSES (30 HARI)
          </div>
          <div className="text-2xl font-extrabold text-ink mt-1">{totalSuccess}</div>
          <div className="text-[11px] text-[color:var(--muted)] mt-1">
            Dari {rows.length} total run
          </div>
        </div>
        <BackupActions />
      </div>

      <section className="bg-surface border border-line rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-line">
          <h2 className="font-bold">History Backup (50 Terbaru)</h2>
        </div>
        {rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-[color:var(--muted)]">
            Belum ada backup. Klik "Backup Sekarang" atau tunggu cron jalan.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[color:var(--surface2)] text-[color:var(--muted)] text-left text-xs">
                <tr>
                  <th className="p-3">Waktu</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 hidden sm:table-cell">Trigger</th>
                  <th className="p-3 hidden md:table-cell">Ukuran</th>
                  <th className="p-3 hidden md:table-cell">Durasi</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="p-3 text-xs whitespace-nowrap">
                      {r.ranAt.toLocaleString("id-ID", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </td>
                    <td className="p-3">
                      {r.status === "success" ? (
                        <span className="text-emerald-700 inline-flex items-center gap-1 text-xs font-bold">
                          <CheckCircle size={12} /> SUKSES
                        </span>
                      ) : (
                        <span
                          className="text-rose-700 inline-flex items-center gap-1 text-xs font-bold"
                          title={r.error ?? ""}
                        >
                          <XCircle size={12} /> GAGAL
                        </span>
                      )}
                      {r.error && (
                        <div className="text-[10px] text-rose-600 mt-0.5 max-w-xs truncate">
                          {r.error}
                        </div>
                      )}
                    </td>
                    <td className="p-3 hidden sm:table-cell text-xs">
                      <span className="px-2 py-0.5 rounded-full bg-[color:var(--surface2)] text-[color:var(--muted)] uppercase font-bold">
                        {r.triggeredBy}
                      </span>
                      {r.userName && (
                        <div className="text-[10px] text-[color:var(--muted)] mt-0.5">
                          {r.userName}
                        </div>
                      )}
                    </td>
                    <td className="p-3 hidden md:table-cell text-xs font-mono">
                      {formatBytes(r.sizeBytes)}
                    </td>
                    <td className="p-3 hidden md:table-cell text-xs font-mono">
                      {formatDuration(r.durationMs)}
                    </td>
                    <td className="p-3 text-right">
                      {r.fileUrl && (
                        <a
                          href={r.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-brand text-xs inline-flex items-center gap-1 hover:underline"
                        >
                          <ExternalLink size={11} /> Drive
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="bg-surface border border-line rounded-2xl p-4 text-xs text-[color:var(--muted)] space-y-1">
        <div className="font-bold text-ink mb-1">📌 Setup Otomatis Daily</div>
        <p>
          Untuk auto-backup harian, jalankan setup systemd timer di server:{" "}
          <code className="bg-[color:var(--surface2)] px-1 py-0.5 rounded">
            sudo bash /opt/depot-air/scripts/setup-backup-timer.sh
          </code>
        </p>
        <p>
          Default schedule: tiap hari jam 02:00. File disimpan di Drive folder yang sama
          dengan bukti pembayaran. Untuk folder dedicated, set{" "}
          <code className="bg-[color:var(--surface2)] px-1 py-0.5 rounded">
            driveFolderBackup
          </code>{" "}
          di Pengaturan.
        </p>
      </div>
    </div>
  );
}
