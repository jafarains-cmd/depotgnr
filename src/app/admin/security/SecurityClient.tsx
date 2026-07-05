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
} from "lucide-react";
import {
  runNpmAudit,
  exportAuditLogCsv,
  revokeAllSessions,
  revokeSession,
  type NpmAuditResult,
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

          <div className="text-[10px] text-[color:var(--muted)] mt-2">
            Kalau ada High/Critical, jalankan{" "}
            <code>npm audit fix</code> di server & deploy ulang.
          </div>
        </div>
      )}
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
