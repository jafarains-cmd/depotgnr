"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  Download,
  RefreshCw,
  LogOut,
  Trash2,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  Copy,
  ExternalLink,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import {
  runNpmAudit,
  exportAuditLogCsv,
  revokeAllSessions,
  revokeSession,
  type NpmAuditResult,
  type NpmAuditVuln,
} from "./actions";

export function SecurityTools() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [audit, setAudit] = useState<NpmAuditResult | null>(null);
  const [auditErr, setAuditErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  function handleAudit() {
    setAuditErr(null);
    setMsg(null);
    startTransition(async () => {
      const res = await runNpmAudit();
      if ("error" in res) setAuditErr(res.error);
      else setAudit(res);
    });
  }

  function handleExport() {
    setMsg(null);
    startTransition(async () => {
      const res = await exportAuditLogCsv();
      if ("error" in res) {
        setMsg(`❌ ${res.error}`);
        return;
      }
      const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const stamp = new Date().toISOString().slice(0, 10);
      a.download = `audit-log-${stamp}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setMsg(`✓ ${res.count} baris audit log diunduh`);
    });
  }

  function handleRevokeAll() {
    const alasan = prompt(
      "REVOKE SEMUA SESSION?\nSemua user (termasuk Anda) akan logout dan harus login ulang.\n\nAlasan (min 3 karakter):",
    );
    if (!alasan || alasan.trim().length < 3) return;
    if (
      !confirm(
        "Yakin? Anda sendiri akan logout & harus login ulang setelah ini.",
      )
    )
      return;
    startTransition(async () => {
      const res = await revokeAllSessions(alasan.trim());
      if ("error" in res) {
        setMsg(`❌ ${res.error}`);
        return;
      }
      setMsg(`✓ ${res.count} session di-revoke. Refresh halaman.`);
      setTimeout(() => router.push("/login"), 2000);
    });
  }

  const sevBadges: Record<string, string> = {
    critical: "bg-red-100 text-red-700 border-red-300",
    high: "bg-orange-100 text-orange-700 border-orange-300",
    moderate: "bg-amber-100 text-amber-800 border-amber-300",
    low: "bg-sky-100 text-sky-700 border-sky-300",
    info: "bg-slate-100 text-slate-700 border-slate-300",
  };

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <button
          onClick={handleAudit}
          disabled={pending}
          className="bg-surface border-2 border-line rounded-xl p-4 text-left hover:border-brand hover:shadow-md transition disabled:opacity-50"
        >
          <div className="inline-flex items-center gap-2 font-extrabold text-sm">
            <ShieldCheck size={16} className="text-emerald-600" />
            Scan Dependencies
          </div>
          <div className="text-[11px] text-[color:var(--muted)] mt-1">
            Jalankan <code>npm audit</code> untuk cek paket dengan vulnerability
          </div>
        </button>

        <button
          onClick={handleExport}
          disabled={pending}
          className="bg-surface border-2 border-line rounded-xl p-4 text-left hover:border-brand hover:shadow-md transition disabled:opacity-50"
        >
          <div className="inline-flex items-center gap-2 font-extrabold text-sm">
            <Download size={16} className="text-sky-600" />
            Export Audit Log
          </div>
          <div className="text-[11px] text-[color:var(--muted)] mt-1">
            Download CSV audit log 30 hari terakhir (max 5000 baris)
          </div>
        </button>

        <button
          onClick={handleRevokeAll}
          disabled={pending}
          className="bg-surface border-2 border-red-200 rounded-xl p-4 text-left hover:border-red-500 hover:shadow-md transition disabled:opacity-50"
        >
          <div className="inline-flex items-center gap-2 font-extrabold text-sm text-red-700">
            <LogOut size={16} className="text-red-600" />
            Revoke Semua Session
          </div>
          <div className="text-[11px] text-red-600 mt-1">
            EMERGENCY: paksa semua user logout (butuh alasan)
          </div>
        </button>
      </div>

      {pending && (
        <div className="text-xs text-[color:var(--muted)] inline-flex items-center gap-1.5">
          <Loader2 size={12} className="animate-spin" /> Memproses…
        </div>
      )}

      {msg && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs font-bold text-emerald-900">
          {msg}
        </div>
      )}

      {auditErr && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs">
          <div className="font-bold text-red-900 inline-flex items-center gap-1.5">
            <AlertTriangle size={12} /> npm audit gagal
          </div>
          <div className="text-red-700 mt-1 font-mono">{auditErr}</div>
        </div>
      )}

      {audit && (
        <div className="bg-surface border border-line rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="font-extrabold text-sm inline-flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-600" />
              Hasil npm audit
            </div>
            <div className="text-[10px] text-[color:var(--muted)]">
              {new Date(audit.ranAt).toLocaleString("id-ID")}
            </div>
          </div>

          <div className="text-[11px] text-[color:var(--muted)]">
            {audit.metadata.dependencies.total} dependencies (
            {audit.metadata.dependencies.prod} prod +{" "}
            {audit.metadata.dependencies.dev} dev)
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {Object.entries(audit.metadata.vulnerabilities).map(([sev, n]) => {
              const total = Number(n) || 0;
              return (
                <div
                  key={sev}
                  className={`rounded-lg border px-2 py-1.5 text-center ${sevBadges[sev] ?? sevBadges.info}`}
                >
                  <div className="text-[10px] font-bold uppercase tracking-wide">
                    {sev}
                  </div>
                  <div className="text-lg font-extrabold">{total}</div>
                </div>
              );
            })}
          </div>

          {Object.values(audit.metadata.vulnerabilities).every(
            (v) => Number(v) === 0,
          ) && (
            <div className="text-xs text-emerald-700 font-bold inline-flex items-center gap-1.5 mt-2">
              <CheckCircle2 size={12} /> Tidak ada vulnerability terdeteksi
            </div>
          )}

          {audit.vulnerabilities.length > 0 && (
            <VulnDetail vulns={audit.vulnerabilities} />
          )}
        </div>
      )}
    </div>
  );
}

function VulnDetail({ vulns }: { vulns: NpmAuditVuln[] }) {
  const [copied, setCopied] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(name: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  }

  // Klasifikasi: yang bisa auto-fix (fixAvailable=true tanpa major), yang butuh
  // manual (major update), yang tidak ada fix
  const autoFixable = vulns.filter(
    (v) => v.fixAvailable === true ||
      (typeof v.fixAvailable === "object" && !v.fixAvailable.isSemVerMajor),
  );
  const manualFix = vulns.filter(
    (v) => typeof v.fixAvailable === "object" && v.fixAvailable.isSemVerMajor,
  );
  const noFix = vulns.filter((v) => v.fixAvailable === false);

  const sevBg: Record<string, string> = {
    critical: "bg-red-50 border-red-300",
    high: "bg-orange-50 border-orange-300",
    moderate: "bg-amber-50 border-amber-300",
    low: "bg-sky-50 border-sky-200",
    info: "bg-slate-50 border-slate-200",
  };
  const sevBadge: Record<string, string> = {
    critical: "bg-red-600 text-white",
    high: "bg-orange-600 text-white",
    moderate: "bg-amber-600 text-white",
    low: "bg-sky-600 text-white",
    info: "bg-slate-600 text-white",
  };

  return (
    <div className="border-t border-line pt-3 mt-3 space-y-3">
      {/* Panduan fix cepat */}
      <div className="bg-brand-soft border border-brand/30 rounded-lg p-3 space-y-2">
        <div className="font-extrabold text-sm inline-flex items-center gap-1.5">
          <ShieldCheck size={14} className="text-brand" />
          Cara Fix — jalankan di server via SSH
        </div>
        <div className="text-xs text-[color:var(--muted)]">
          Login ke server Proxmox, masuk container Depot Air, lalu jalankan
          command sesuai kategori vulnerability:
        </div>

        {autoFixable.length > 0 && (
          <FixCard
            title={`✓ ${autoFixable.length} vulnerability BISA di-auto-fix (aman)`}
            desc="Update ke versi patch/minor — tidak breaking changes."
            command="cd /opt/depot-air && npm audit fix && sudo depot-update"
            note="Ini paling aman. Command update package, rebuild, restart service."
            onCopy={(t) => copy(t, "auto")}
            copied={copied === "auto"}
            variant="ok"
          />
        )}

        {manualFix.length > 0 && (
          <FixCard
            title={`⚠ ${manualFix.length} vulnerability butuh MAJOR UPDATE`}
            desc="Bisa breaking changes — review dulu changelog paketnya."
            command="cd /opt/depot-air && npm audit fix --force"
            note="RESIKO: bisa break build. Test dulu di dev, atau update satu-satu manual pakai `npm install <pkg>@latest`."
            onCopy={(t) => copy(t, "force")}
            copied={copied === "force"}
            variant="warn"
          />
        )}

        {noFix.length > 0 && (
          <div className="bg-surface border border-line rounded p-2 text-xs">
            <b>{noFix.length} vulnerability tanpa fix tersedia</b>
            <div className="text-[color:var(--muted)] mt-1">
              Belum ada patch dari maintainer. Cek advisory link di detail
              paket. Kalau critical, pertimbangkan replace paket alternatif.
            </div>
          </div>
        )}

        <div className="text-[10px] text-[color:var(--muted)] italic pt-1 border-t border-brand/20">
          Tip: setelah `npm audit fix`, jalankan `npm run build` untuk verify
          tidak ada error, lalu `sudo systemctl restart depot-air`. Command
          `sudo depot-update` sudah include semua langkah tsb.
        </div>
      </div>

      {/* Detail per paket */}
      <div>
        <div className="text-xs font-bold text-[color:var(--muted)] uppercase mb-1.5">
          Detail per Paket ({vulns.length})
        </div>
        <div className="space-y-1.5">
          {vulns.map((v) => {
            const isOpen = expanded.has(v.name);
            const fixLabel =
              v.fixAvailable === false
                ? "Tidak ada fix"
                : v.fixAvailable === true
                  ? "Auto-fix aman"
                  : v.fixAvailable.isSemVerMajor
                    ? `Major update → ${v.fixAvailable.name}@${v.fixAvailable.version}`
                    : `Update ke ${v.fixAvailable.name}@${v.fixAvailable.version}`;
            const advisoryUrl = v.via
              .filter((x): x is { url: string } => typeof x === "object" && "url" in x && !!x.url)
              .map((x) => x.url)[0];

            return (
              <div
                key={v.name}
                className={`border rounded-lg overflow-hidden ${sevBg[v.severity] ?? sevBg.info}`}
              >
                <button
                  onClick={() => toggle(v.name)}
                  className="w-full flex justify-between items-center p-2.5 text-left hover:bg-black/5"
                >
                  <div className="min-w-0 flex-1 flex items-center gap-2">
                    {isOpen ? (
                      <ChevronDown size={12} />
                    ) : (
                      <ChevronRight size={12} />
                    )}
                    <span
                      className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded ${sevBadge[v.severity] ?? sevBadge.info}`}
                    >
                      {v.severity}
                    </span>
                    <span className="font-mono font-bold text-sm truncate">
                      {v.name}
                    </span>
                    {v.isDirect && (
                      <span className="text-[9px] px-1 py-0.5 rounded bg-brand-soft text-brand font-bold">
                        DIRECT
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-[color:var(--muted)] ml-2 whitespace-nowrap">
                    {fixLabel}
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-line/50 p-2.5 text-xs space-y-2 bg-surface/50">
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <div className="font-bold text-[color:var(--muted)]">Range</div>
                        <div className="font-mono">{v.range || "—"}</div>
                      </div>
                      <div>
                        <div className="font-bold text-[color:var(--muted)]">Fix</div>
                        <div>{fixLabel}</div>
                      </div>
                    </div>

                    {v.via.length > 0 && (
                      <div>
                        <div className="font-bold text-[color:var(--muted)] text-[11px] mb-1">
                          Via (rantai dependency)
                        </div>
                        <div className="space-y-1 text-[11px]">
                          {v.via.slice(0, 5).map((via, i) => {
                            if (typeof via === "string") {
                              return (
                                <div key={i} className="font-mono">
                                  → {via}
                                </div>
                              );
                            }
                            return (
                              <div key={i}>
                                <div className="font-bold">
                                  {via.title || via.name}
                                </div>
                                {via.url && (
                                  <a
                                    href={via.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-brand hover:underline inline-flex items-center gap-1"
                                  >
                                    <ExternalLink size={10} /> Advisory
                                  </a>
                                )}
                              </div>
                            );
                          })}
                          {v.via.length > 5 && (
                            <div className="text-[color:var(--muted)] italic">
                              +{v.via.length - 5} lainnya…
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {v.effects.length > 0 && (
                      <div>
                        <div className="font-bold text-[color:var(--muted)] text-[11px] mb-1">
                          Mempengaruhi paket
                        </div>
                        <div className="font-mono text-[11px]">
                          {v.effects.slice(0, 8).join(", ")}
                          {v.effects.length > 8 && ` +${v.effects.length - 8}`}
                        </div>
                      </div>
                    )}

                    {v.fixAvailable !== false && (
                      <div className="pt-2 border-t border-line/50">
                        <div className="font-bold text-[color:var(--muted)] text-[11px] mb-1">
                          Command manual untuk paket ini
                        </div>
                        <div className="flex items-center gap-1.5">
                          <code className="flex-1 bg-black/5 px-2 py-1 rounded text-[10px] font-mono overflow-x-auto">
                            npm install {typeof v.fixAvailable === "object"
                              ? `${v.fixAvailable.name}@${v.fixAvailable.version}`
                              : `${v.name}@latest`}
                          </code>
                          <button
                            onClick={() =>
                              copy(
                                `npm install ${typeof v.fixAvailable === "object" ? `${v.fixAvailable.name}@${v.fixAvailable.version}` : `${v.name}@latest`}`,
                                v.name,
                              )
                            }
                            className="p-1 hover:bg-brand-soft rounded"
                            title="Copy"
                          >
                            <Copy size={12} className={copied === v.name ? "text-emerald-600" : ""} />
                          </button>
                        </div>
                      </div>
                    )}

                    {advisoryUrl && (
                      <a
                        href={advisoryUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-brand font-bold hover:underline inline-flex items-center gap-1"
                      >
                        <ExternalLink size={11} /> Buka advisory GitHub
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function FixCard({
  title,
  desc,
  command,
  note,
  onCopy,
  copied,
  variant,
}: {
  title: string;
  desc: string;
  command: string;
  note: string;
  onCopy: (text: string) => void;
  copied: boolean;
  variant: "ok" | "warn";
}) {
  const bg =
    variant === "ok"
      ? "bg-emerald-50 border-emerald-200"
      : "bg-amber-50 border-amber-200";
  return (
    <div className={`border rounded-lg p-2.5 space-y-1.5 ${bg}`}>
      <div className="font-extrabold text-xs">{title}</div>
      <div className="text-[11px] text-[color:var(--muted)]">{desc}</div>
      <div className="flex items-center gap-1.5">
        <code className="flex-1 bg-black/5 px-2 py-1.5 rounded text-[10px] font-mono overflow-x-auto whitespace-nowrap">
          {command}
        </code>
        <button
          onClick={() => onCopy(command)}
          className="p-1.5 hover:bg-white rounded border border-line"
          title="Copy command"
        >
          {copied ? (
            <CheckCircle2 size={12} className="text-emerald-600" />
          ) : (
            <Copy size={12} />
          )}
        </button>
      </div>
      <div className="text-[10px] text-[color:var(--muted)] italic">{note}</div>
    </div>
  );
}

export function RevokeSessionButton({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handle() {
    if (!confirm("Paksa logout session ini?")) return;
    startTransition(async () => {
      const res = await revokeSession(sessionId);
      if ("error" in res) alert(`Gagal: ${res.error}`);
      else router.refresh();
    });
  }

  return (
    <button
      onClick={handle}
      disabled={pending}
      className="text-red-600 hover:bg-red-50 p-1 rounded disabled:opacity-50"
      title="Revoke session"
    >
      <Trash2 size={12} />
    </button>
  );
}

export function RefreshButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      onClick={() => startTransition(() => router.refresh())}
      disabled={pending}
      className="px-3 py-1.5 border border-line rounded-lg text-xs font-bold inline-flex items-center gap-1.5 hover:bg-surface disabled:opacity-50"
    >
      <RefreshCw size={12} className={pending ? "animate-spin" : ""} />
      Refresh
    </button>
  );
}
