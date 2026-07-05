import {
  Shield,
  Activity,
  Users,
  AlertTriangle,
  Database,
  Server,
  Clock,
  Lock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  KeyRound,
  HardDrive,
} from "lucide-react";
import { requireRole } from "@/lib/permissions";
import { PageHeader } from "@/components/AppShell";
import {
  getSecurityHealth,
  getUserStat,
  getAnomalies,
  getAuditStat,
  getEnvCheck,
  type HealthStat,
} from "@/lib/security-stats";
import { SecurityTools, RefreshButton } from "./SecurityClient";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  kasir: "Kasir",
  kurir: "Kurir",
  pelanggan: "Pelanggan",
};

function statusIcon(status: HealthStat["status"]) {
  if (status === "ok") return <CheckCircle2 size={14} className="text-emerald-600" />;
  if (status === "warning") return <AlertCircle size={14} className="text-amber-600" />;
  return <XCircle size={14} className="text-red-600" />;
}

function statusBg(status: HealthStat["status"]) {
  if (status === "ok") return "bg-emerald-50 border-emerald-200";
  if (status === "warning") return "bg-amber-50 border-amber-200";
  return "bg-red-50 border-red-200";
}

function fmtBytes(n: number | null): string {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export default async function SecurityDashboard() {
  await requireRole(["admin"]);

  const [health, users, anomalies, audit, envCheck] = await Promise.all([
    getSecurityHealth(),
    getUserStat(),
    getAnomalies(),
    getAuditStat(),
    Promise.resolve(getEnvCheck()),
  ]);

  const critical = anomalies.filter((a) => a.severity === "critical").length;
  const warning = anomalies.filter((a) => a.severity === "warning").length;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <PageHeader
          title="Security Dashboard"
          description="Monitoring kesehatan sistem, akses user, dan anomali. Hanya untuk admin."
        />
        <RefreshButton />
      </div>

      {/* Summary alert bar */}
      {(critical > 0 || warning > 0) && (
        <div
          className={`rounded-2xl border-2 p-3 inline-flex items-center gap-3 ${
            critical > 0
              ? "bg-red-50 border-red-300"
              : "bg-amber-50 border-amber-300"
          }`}
        >
          <AlertTriangle
            size={20}
            className={critical > 0 ? "text-red-600" : "text-amber-600"}
          />
          <div className="text-sm font-bold">
            {critical > 0 && <span className="text-red-800">{critical} CRITICAL</span>}
            {critical > 0 && warning > 0 && " · "}
            {warning > 0 && <span className="text-amber-800">{warning} WARNING</span>}
            <span className="text-[color:var(--muted)] font-normal ml-1">
              — lihat section Anomali di bawah
            </span>
          </div>
        </div>
      )}

      {/* SECTION 1: KESEHATAN SISTEM */}
      <section>
        <SectionTitle icon={<Server size={16} />} label="Kesehatan Sistem" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <HealthCard
            icon={<HardDrive size={16} />}
            title="Backup Google Drive"
            status={health.backup}
          >
            {health.backup.lastRunAt ? (
              <>
                <div>Terakhir: {health.backup.lastRunAt.toLocaleString("id-ID")}</div>
                <div>Umur: {Math.round(health.backup.ageHours ?? 0)} jam</div>
                <div>Ukuran: {fmtBytes(health.backup.sizeBytes)}</div>
              </>
            ) : (
              <div>Belum pernah backup — cek /admin/backup</div>
            )}
          </HealthCard>

          <HealthCard
            icon={<Database size={16} />}
            title="Database SQLite"
            status={health.database}
          >
            <div>Ukuran: {health.database.sizeMB ? `${health.database.sizeMB} MB` : "—"}</div>
            <div className="text-[10px] font-mono truncate" title={health.database.path}>
              {health.database.path}
            </div>
          </HealthCard>

          <HealthCard
            icon={<Clock size={16} />}
            title="Runtime Server"
            status={{ status: "ok", message: "Aktif" }}
          >
            <div>Uptime: {health.uptime.formatted}</div>
            <div>Node: {health.runtime.nodeVersion}</div>
            <div>
              {health.runtime.platform} · {health.runtime.arch}
            </div>
          </HealthCard>

          <HealthCard
            icon={<Lock size={16} />}
            title="Session Aktif"
            status={{ status: "ok", message: `${health.session.active} aktif` }}
          >
            <div>Aktif sekarang: {health.session.active}</div>
            <div>Expired 24h: {health.session.expired24h}</div>
          </HealthCard>

          <HealthCard
            icon={<KeyRound size={16} />}
            title="Konfigurasi Secret"
            status={{
              status: envCheck.criticalConfigured.BETTER_AUTH_SECRET
                ? "ok"
                : "critical",
              message: envCheck.criticalConfigured.BETTER_AUTH_SECRET
                ? "Ter-set"
                : "BELUM di-set",
            }}
          >
            <div>
              BETTER_AUTH_SECRET:{" "}
              {envCheck.criticalConfigured.BETTER_AUTH_SECRET ? "✓" : "❌"}
            </div>
            <div>
              TELEGRAM_BOT_TOKEN:{" "}
              {envCheck.optionalConfigured.TELEGRAM_BOT_TOKEN ? "✓" : "○ (opsional)"}
            </div>
            <div>
              GOOGLE_DRIVE_SCRIPT_URL:{" "}
              {envCheck.optionalConfigured.GOOGLE_DRIVE_SCRIPT_URL ? "✓" : "○ (opsional)"}
            </div>
          </HealthCard>

          <HealthCard
            icon={<Shield size={16} />}
            title="Env Public Vars"
            status={{
              status: envCheck.publicVars.some((v) => v.suspicious)
                ? "critical"
                : "ok",
              message: envCheck.publicVars.some((v) => v.suspicious)
                ? "Ada nama mencurigakan!"
                : `${envCheck.publicVars.length} var aman`,
            }}
          >
            {envCheck.publicVars.length === 0 ? (
              <div>Tidak ada NEXT_PUBLIC_* — aman</div>
            ) : (
              <div className="space-y-0.5">
                {envCheck.publicVars.map((v) => (
                  <div key={v.name} className={v.suspicious ? "text-red-700 font-bold" : ""}>
                    {v.suspicious ? "⚠" : "•"} {v.name}
                  </div>
                ))}
                <div className="text-[10px] text-[color:var(--muted)] italic mt-1">
                  NEXT_PUBLIC_* di-bundle ke client — jangan isi secret.
                </div>
              </div>
            )}
          </HealthCard>
        </div>
      </section>

      {/* SECTION 2: AKSES & USER */}
      <section>
        <SectionTitle icon={<Users size={16} />} label="Akses & User" />
        <div className="grid lg:grid-cols-3 gap-3">
          <div className="bg-surface border border-line rounded-xl p-4">
            <div className="text-xs font-bold text-[color:var(--muted)] uppercase mb-2">
              User per Role
            </div>
            <div className="space-y-1.5">
              {users.perRole.map((r) => (
                <div key={r.role} className="flex justify-between text-sm">
                  <span>{ROLE_LABEL[r.role] ?? r.role}</span>
                  <span className="font-bold">
                    {r.count}
                    {r.banned > 0 && (
                      <span className="text-red-600 ml-1">({r.banned} banned)</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
            {users.admins.length > 3 && (
              <div className="mt-2 pt-2 border-t border-line text-[10px] text-amber-700">
                ⚠ {users.admins.length} admin — pertimbangkan minimum privilege
              </div>
            )}
          </div>

          <div className="bg-surface border border-line rounded-xl p-4 lg:col-span-2">
            <div className="text-xs font-bold text-[color:var(--muted)] uppercase mb-2 inline-flex items-center gap-1.5">
              <Activity size={12} /> Session Aktif Sekarang ({users.activeSessions.length})
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-[color:var(--muted)]">
                  <tr>
                    <th className="text-left py-1">User</th>
                    <th className="text-left py-1">IP</th>
                    <th className="text-left py-1">Browser</th>
                    <th className="text-left py-1">Login</th>
                    <th className="text-right py-1">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {users.activeSessions.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-4 text-center text-[color:var(--muted)] italic">
                        Tidak ada session aktif.
                      </td>
                    </tr>
                  )}
                  {users.activeSessions.slice(0, 8).map((s) => (
                    <tr key={s.userId + s.createdAt.toISOString()}>
                      <td className="py-1.5 font-bold">{s.userName}</td>
                      <td className="py-1.5 font-mono text-[10px]">{s.ipAddress ?? "—"}</td>
                      <td className="py-1.5 text-[10px] max-w-[200px] truncate" title={s.userAgent ?? ""}>
                        {parseUA(s.userAgent)}
                      </td>
                      <td className="py-1.5 text-[10px]">
                        {s.createdAt.toLocaleString("id-ID", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="py-1.5 text-right">
                        {/* Session ID tidak di-fetch — placeholder */}
                        <span className="text-[10px] text-[color:var(--muted)]">—</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: ANOMALI */}
      <section>
        <SectionTitle
          icon={<AlertTriangle size={16} />}
          label={`Anomali Terdeteksi (${anomalies.length})`}
        />
        {anomalies.length === 0 ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center text-sm text-emerald-800 font-bold inline-flex items-center gap-2 w-full justify-center">
            <CheckCircle2 size={16} /> Tidak ada anomali terdeteksi
          </div>
        ) : (
          <div className="space-y-2">
            {anomalies.map((a, i) => {
              const bg =
                a.severity === "critical"
                  ? "bg-red-50 border-red-300"
                  : a.severity === "warning"
                    ? "bg-amber-50 border-amber-300"
                    : "bg-sky-50 border-sky-200";
              const badge =
                a.severity === "critical"
                  ? "bg-red-600 text-white"
                  : a.severity === "warning"
                    ? "bg-amber-600 text-white"
                    : "bg-sky-600 text-white";
              return (
                <div
                  key={i}
                  className={`border rounded-xl p-3 flex justify-between items-start gap-3 ${bg}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="inline-flex items-center gap-1.5 mb-1">
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded font-extrabold uppercase tracking-wide ${badge}`}
                      >
                        {a.severity}
                      </span>
                      <span className="font-extrabold text-sm">{a.label}</span>
                    </div>
                    <div className="text-xs text-[color:var(--muted)]">{a.detail}</div>
                  </div>
                  {a.href && (
                    <a
                      href={a.href}
                      className="text-xs font-bold text-brand hover:underline whitespace-nowrap"
                    >
                      Buka →
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* SECTION 4: AKTIVITAS AUDIT */}
      <section>
        <SectionTitle
          icon={<Activity size={16} />}
          label={`Aktivitas Kritis 7 Hari (${audit.total7d})`}
        />
        <div className="grid lg:grid-cols-2 gap-3">
          <div className="bg-surface border border-line rounded-xl p-4">
            <div className="text-xs font-bold text-[color:var(--muted)] uppercase mb-2">
              Top Actions
            </div>
            {audit.perAction.length === 0 ? (
              <div className="text-xs italic text-[color:var(--muted)]">
                Tidak ada aktivitas
              </div>
            ) : (
              <div className="space-y-1">
                {audit.perAction.map((a) => {
                  const max = audit.perAction[0].count || 1;
                  const pct = Math.max(5, (a.count / max) * 100);
                  return (
                    <div key={a.action} className="text-xs">
                      <div className="flex justify-between">
                        <span className="font-mono">{a.action}</span>
                        <span className="font-bold">{a.count}</span>
                      </div>
                      <div className="h-1 bg-line rounded-full mt-0.5 overflow-hidden">
                        <div
                          className="h-full bg-brand rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-surface border border-line rounded-xl p-4">
            <div className="text-xs font-bold text-[color:var(--muted)] uppercase mb-2">
              Top Actor
            </div>
            {audit.topActors.length === 0 ? (
              <div className="text-xs italic text-[color:var(--muted)]">
                Tidak ada aktor
              </div>
            ) : (
              <div className="space-y-1.5">
                {audit.topActors.map((a) => (
                  <div key={a.userId ?? "system"} className="flex justify-between text-sm">
                    <span>{a.name ?? "—"}</span>
                    <span className="font-bold">{a.count}x</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-3 bg-surface border border-line rounded-xl p-4">
          <div className="text-xs font-bold text-[color:var(--muted)] uppercase mb-2">
            15 Aktivitas Terbaru
          </div>
          <div className="space-y-0.5 max-h-[300px] overflow-y-auto text-xs">
            {audit.recent.map((r) => (
              <div key={r.id} className="flex justify-between items-center py-1 border-b border-line/50 last:border-0">
                <div className="min-w-0 flex-1">
                  <span className="font-mono text-[10px]">{r.action}</span>{" "}
                  <span className="text-[color:var(--muted)]">
                    · {r.entity}
                    {r.entityId ? `#${r.entityId}` : ""}
                  </span>
                </div>
                <div className="text-[10px] text-[color:var(--muted)] ml-2 whitespace-nowrap">
                  {r.actorName ?? "—"} ·{" "}
                  {r.createdAt.toLocaleString("id-ID", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            ))}
            {audit.recent.length === 0 && (
              <div className="italic text-[color:var(--muted)]">Belum ada log</div>
            )}
          </div>
          <div className="mt-2 text-right">
            <a href="/admin/audit-log" className="text-xs font-bold text-brand hover:underline">
              Lihat semua di /admin/audit-log →
            </a>
          </div>
        </div>
      </section>

      {/* SECTION 5: MANUAL TOOLS */}
      <section>
        <SectionTitle icon={<Shield size={16} />} label="Manual Security Tools" />
        <SecurityTools />
      </section>

      {/* SECTION 6: PANDUAN */}
      <section>
        <SectionTitle icon={<Lock size={16} />} label="Panduan & Best Practice" />
        <div className="bg-surface border border-line rounded-xl p-4 space-y-2 text-xs">
          <div>
            <b>Rutinitas mingguan:</b>
            <ul className="list-disc list-inside ml-2 mt-1 space-y-0.5 text-[color:var(--muted)]">
              <li>Cek section Anomali — resolve semua CRITICAL sebelum lanjut kerja</li>
              <li>Klik "Scan Dependencies" — kalau ada High/Critical, run <code>npm audit fix</code> di server</li>
              <li>Cek "Session Aktif" — ada login mencurigakan? Revoke via section akses</li>
              <li>Export audit log untuk arsip</li>
            </ul>
          </div>
          <div className="pt-2 border-t border-line">
            <b>Rutinitas bulanan:</b>
            <ul className="list-disc list-inside ml-2 mt-1 space-y-0.5 text-[color:var(--muted)]">
              <li>Rotate <code>BETTER_AUTH_SECRET</code> di server → force logout semua via "Revoke Semua Session"</li>
              <li>Review daftar admin: masih perlu semua? Downgrade jadi kasir kalau bisa</li>
              <li>Test restore backup dari Google Drive (simulasi disaster recovery)</li>
              <li>Update Node.js kalau ada patch security</li>
            </ul>
          </div>
          <div className="pt-2 border-t border-line">
            <b>Kalau curiga incident:</b>
            <ul className="list-disc list-inside ml-2 mt-1 space-y-0.5 text-[color:var(--muted)]">
              <li>Screenshot dashboard ini sebagai snapshot</li>
              <li>Export audit log CSV untuk analisis</li>
              <li>Revoke semua session (paksa re-login)</li>
              <li>Rotate <code>BETTER_AUTH_SECRET</code> di server</li>
              <li>Ganti password admin</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}

function SectionTitle({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <h2 className="text-sm font-extrabold uppercase tracking-widest text-[color:var(--muted)] mb-2 inline-flex items-center gap-1.5">
      {icon} {label}
    </h2>
  );
}

function HealthCard({
  icon,
  title,
  status,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  status: HealthStat;
  children: React.ReactNode;
}) {
  return (
    <div className={`border rounded-xl p-3 ${statusBg(status.status)}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="inline-flex items-center gap-1.5 font-extrabold text-sm">
          {icon}
          {title}
        </div>
        <div className="inline-flex items-center gap-1 text-[10px] font-bold">
          {statusIcon(status.status)}
          <span>{status.message}</span>
        </div>
      </div>
      <div className="text-xs text-[color:var(--muted)] mt-2 space-y-0.5">
        {children}
      </div>
    </div>
  );
}

function parseUA(ua: string | null): string {
  if (!ua) return "—";
  if (/mobile/i.test(ua)) {
    if (/android/i.test(ua)) return "Android";
    if (/iphone/i.test(ua)) return "iPhone";
    return "Mobile";
  }
  if (/chrome/i.test(ua)) return "Chrome";
  if (/firefox/i.test(ua)) return "Firefox";
  if (/safari/i.test(ua)) return "Safari";
  if (/edg/i.test(ua)) return "Edge";
  return ua.slice(0, 30);
}
