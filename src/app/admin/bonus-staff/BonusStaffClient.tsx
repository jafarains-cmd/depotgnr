"use client";

import { useState, useTransition } from "react";
import { Check, User } from "lucide-react";
import { bayarBonusStaffAction } from "./actions";
import { formatRupiah } from "@/lib/utils";

export type StaffSummary = {
  staffUserId: string;
  staffNama: string;
  staffRole: string;
  pendingTotal: number;
  pendingCount: number;
  paidTotal: number;
  totalPelanggan: number;
};

export type BonusRow = {
  id: number;
  staffNama: string;
  pelangganNama: string;
  nominal: number;
  status: string;
  paidAt: string | null;
  createdAt: string;
};

export function BonusStaffClient({
  summary,
  detail,
}: {
  summary: StaffSummary[];
  detail: BonusRow[];
}) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function bayarStaff(k: StaffSummary) {
    if (k.pendingCount === 0) return;
    if (
      !confirm(
        `Tandai semua bonus pending ${k.staffNama} (${k.pendingCount} pelanggan, total ${formatRupiah(
          k.pendingTotal,
        )}) sebagai SUDAH DIBAYAR?`,
      )
    )
      return;
    setMsg(null);
    startTransition(async () => {
      const r = await bayarBonusStaffAction(k.staffUserId);
      if ("error" in r) setMsg(`❌ ${r.error}`);
      else setMsg(`✅ ${r.count} bonus ${k.staffNama} ditandai dibayar (${formatRupiah(r.total)})`);
    });
  }

  return (
    <div className="space-y-5">
      <section>
        <h2 className="text-sm font-bold tracking-widest text-[color:var(--muted)] mb-2">
          PER STAFF
        </h2>
        {summary.length === 0 ? (
          <div className="bg-surface border border-line rounded-2xl p-8 text-center text-[color:var(--muted)] text-sm">
            Belum ada bonus referral staff tercatat. Bonus akan muncul saat
            pelanggan baru yang di-ajak melakukan order pertama.
          </div>
        ) : (
          <div className="space-y-2">
            {summary
              .sort((a, b) => b.pendingTotal - a.pendingTotal)
              .map((k) => (
                <div
                  key={k.staffUserId}
                  className="bg-surface border border-line rounded-2xl p-4 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="font-bold inline-flex items-center gap-1.5">
                      <User size={14} className="text-brand" /> {k.staffNama}
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[color:var(--surface2)] text-[color:var(--muted)] font-bold uppercase">
                        {k.staffRole}
                      </span>
                    </div>
                    <div className="text-xs text-[color:var(--muted)] mt-1">
                      Total {k.totalPelanggan} pelanggan aktif · {k.pendingCount} pending
                    </div>
                    <div className="flex gap-3 mt-2 text-sm">
                      <div>
                        <span className="text-[color:var(--muted)]">Pending: </span>
                        <span className="font-extrabold text-amber-700">
                          {formatRupiah(k.pendingTotal)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[color:var(--muted)]">Dibayar: </span>
                        <span className="font-bold text-emerald-700">
                          {formatRupiah(k.paidTotal)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => bayarStaff(k)}
                    disabled={pending || k.pendingCount === 0}
                    className="flex-shrink-0 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-extrabold inline-flex items-center gap-1.5 disabled:opacity-30 active:scale-[0.98]"
                  >
                    <Check size={14} /> Tandai Dibayar
                  </button>
                </div>
              ))}
          </div>
        )}
        {msg && (
          <div className="mt-3 text-sm bg-[color:var(--surface2)] border border-line rounded p-2">
            {msg}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-bold tracking-widest text-[color:var(--muted)] mb-2">
          HISTORY (TERBARU)
        </h2>
        <div className="bg-surface border border-line rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[color:var(--surface2)] text-[color:var(--muted)] text-left">
                <tr>
                  <th className="p-3">Tanggal</th>
                  <th className="p-3">Staff</th>
                  <th className="p-3 hidden sm:table-cell">Pelanggan</th>
                  <th className="p-3 text-right">Bonus</th>
                  <th className="p-3 hidden sm:table-cell">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {detail.map((d) => (
                  <tr key={d.id}>
                    <td className="p-3 text-xs">
                      {new Date(d.createdAt).toLocaleDateString("id-ID", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="p-3 text-sm font-medium">
                      {d.staffNama}
                      <div className="sm:hidden text-[10px] text-[color:var(--muted)] mt-0.5 truncate">
                        Pelanggan: {d.pelangganNama}
                      </div>
                      <div className="sm:hidden text-[10px] text-[color:var(--muted)] mt-0.5">
                        {d.status.toUpperCase()}
                      </div>
                    </td>
                    <td className="p-3 text-xs hidden sm:table-cell">{d.pelangganNama}</td>
                    <td className="p-3 text-right text-sm font-bold">{formatRupiah(d.nominal)}</td>
                    <td className="p-3 hidden sm:table-cell">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          d.status === "dibayar"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {d.status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
                {detail.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-[color:var(--muted)]">
                      Belum ada history.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
