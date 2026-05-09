/**
 * CLI: jalankan backup database (untuk systemd timer / cron).
 *
 * Usage: npm run db:backup
 *
 * Idempotent — aman dipanggil berulang. Akan insert log entry ke
 * `backup_log` setiap dijalankan, success atau failed.
 */
import "dotenv/config";
import { runBackup } from "../lib/backup";

async function main() {
  console.log("→ Running backup...");
  const r = await runBackup({ triggeredBy: "cron" });
  if ("error" in r) {
    console.error("✗ Backup failed:", r.error);
    process.exit(1);
  }
  const sizeMb = (r.sizeBytes / 1024 / 1024).toFixed(2);
  console.log(`✓ Backup success. Log id=${r.logId}, size=${sizeMb}MB`);
  console.log(`  Drive URL: ${r.url}`);
  process.exit(0);
}

main().catch((e) => {
  console.error("Unhandled error:", e);
  process.exit(1);
});
