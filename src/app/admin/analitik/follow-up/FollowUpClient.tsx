"use client";

import { useState, useTransition, useMemo } from "react";
import { Send, AlertTriangle, Clock, Calendar, CheckSquare, Square } from "lucide-react";
import { kirimReminder, kirimReminderMassal } from "./actions";

type Row = {
  pelangganId: number;
  nama: string;
  telp: string | null;
  userId: string | null;
  totalOrder: number;
  lastOrderAt: string;
  avgIntervalDays: number;
  stdDevDays: number;
  predictedNext: string;
  daysSinceLastOrder: number;
  daysOverdue: number;
  zScore: number;
  status: "due" | "overdue" | "churn-risk" | "not-due";
};

const STATUS: Record<Row["status"], { label: string; cls: string; icon: React.ReactNode }> = {
  "churn-risk": {
    label: "Churn Risk",
    cls: "bg-red-100 text-red-700",
    icon: <AlertTriangle size={12} />,
  },
  overdue: {
    label: "Overdue",
    cls: "bg-amber-100 text-amber-700",
    icon: <Clock size={12} />,
  },
  due: {
    label: "Due",
    cls: "bg-blue-100 text-blue-700",
    icon: <Calendar size={12} />,
  },
  "not-due": {
    label: "Belum waktunya",
    cls: "bg-[color:var(--surface2)] text-[color:var(--muted)]",
    icon: null,
  },
};

export function FollowUpClient({ rows }: { rows: Row[] }) {
  const [filter, setFilter] = useState<Row["status"] | "actionable" | "all">("actionable");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (filter === "all") return rows;
    if (filter === "actionable")
      return rows.filter((r) => r.status === "due" || r.status === "overdue" || r.status === "churn-risk");
    return rows.filter((r) => r.status === filter);
  }, [rows, filter]);

  function toggle(id: number) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((r) => r.pelangganId)));
    }
  }

  function sendOne(id: number) {
    setMsg(null);
    startTransition(async () => {
      const r = await kirimReminder(id);
      if ("error" in r) setMsg(`❌ ${r.error}`);
      else setMsg("✅ Reminder terkirim");
    });
  }

  function sendBulk() {
    if (selected.size === 0) {
      setMsg("Pilih minimal 1 pelanggan");
      return;
    }
    if (!confirm(`Kirim reminder ke ${selected.size} pelanggan?`)) return;
    setMsg(null);
    startTransition(async () => {
      const r = await kirimReminderMassal(Array.from(selected));
      setMsg(`✅ ${r.sent} terkirim, ❌ ${r.failed} gagal`);
      setSelected(new Set());
    });
  }

  const counts = useMemo(
    () => ({
      churn: rows.filter((r) => r.status === "churn-risk").length,
      overdue: rows.filter((r) => r.status === "overdue").length,
      due: rows.filter((r) => r.status === "due").length,
      total: rows.length,
    }),
    [rows],
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatCard label="Churn Risk" value={counts.churn} cls="bg-red-50 border-red-200 text-red-700" />
        <StatCard label="Overdue" value={counts.overdue} cls="bg-amber-50 border-amber-200 text-amber-700" />
        <StatCard label="Due" value={counts.due} cls="bg-blue-50 border-blue-200 text-blue-700" />
        <StatCard label="Total Tracked" value={counts.total} cls="bg-[color:var(--surface2)] border-line text-ink" />
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {(["actionable", "churn-risk", "overdue", "due", "not-due", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-md text-sm ${
              filter === f ? "bg-brand-600 text-white" : "bg-surface border border-line"
            }`}
          >
            {f === "actionable" ? "Yang Perlu Follow-up" : f === "all" ? "Semua" : STATUS[f as Row["status"]].label}
          </button>
        ))}
      </div>

      {filtered.length > 0 && (
        <div className="flex items-center justify-between bg-surface border border-line rounded-md px-3 py-2">
          <button onClick={toggleAll} className="text-sm inline-flex items-center gap-1.5">
            {selected.size === filtered.length ? <CheckSquare size={14} /> : <Square size={14} />}
            {selected.size === filtered.length ? "Batalkan semua" : "Pilih semua"}
            {selected.size > 0 && (
              <span className="text-xs text-[color:var(--muted)]">({selected.size} dipilih)</span>
            )}
          </button>
          <button
            onClick={sendBulk}
            disabled={pending || selected.size === 0}
            className="px-3 py-1.5 bg-emerald-600 text-white rounded text-sm inline-flex items-center gap-1 disabled:opacity-50"
          >
            <Send size={12} /> Kirim Reminder ({selected.size})
          </button>
        </div>
      )}

      {msg && (
        <div className="text-sm text-ink bg-[color:var(--surface2)] border border-line rounded p-2">
          {msg}
        </div>
      )}

      <div className="bg-surface border border-line rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[color:var(--surface2)] text-[color:var(--muted)] text-left">
            <tr>
              <th className="p-3 w-8"></th>
              <th className="p-3">Pelanggan</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right hidden md:table-cell">Order</th>
              <th className="p-3 hidden md:table-cell">Pola</th>
              <th className="p-3">Terakhir / Prediksi</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filtered.map((r) => {
              const s = STATUS[r.status];
              return (
                <tr key={r.pelangganId}>
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={selected.has(r.pelangganId)}
                      onChange={() => toggle(r.pelangganId)}
                    />
                  </td>
                  <td className="p-3">
                    <div className="font-medium">{r.nama}</div>
                    {r.telp && <div className="text-xs text-[color:var(--muted)]">{r.telp}</div>}
                  </td>
                  <td className="p-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${s.cls}`}
                    >
                      {s.icon} {s.label}
                    </span>
                  </td>
                  <td className="p-3 text-right hidden md:table-cell">{r.totalOrder}</td>
                  <td className="p-3 text-xs hidden md:table-cell">
                    Tiap ~{r.avgIntervalDays}h ± {r.stdDevDays}h
                  </td>
                  <td className="p-3 text-xs">
                    <div>
                      {new Date(r.lastOrderAt).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                      })}
                      <span className="text-[color:var(--muted)]"> · {r.daysSinceLastOrder}h lalu</span>
                    </div>
                    <div className="text-[color:var(--muted)]">
                      Prediksi:{" "}
                      {new Date(r.predictedNext).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                      })}
                      {r.daysOverdue > 0 && (
                        <span className="text-red-600"> ({r.daysOverdue}h lewat)</span>
                      )}
                    </div>
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => sendOne(r.pelangganId)}
                      disabled={pending}
                      className="px-2.5 py-1 bg-brand-600 text-white rounded text-xs inline-flex items-center gap-1 disabled:opacity-50"
                    >
                      <Send size={11} /> WA
                    </button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-[color:var(--muted)]">
                  Tidak ada data.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <div className={`border rounded-xl p-3 ${cls}`}>
      <div className="text-xs">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}
