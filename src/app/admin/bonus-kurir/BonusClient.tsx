"use client";

import { useState, useTransition } from "react";
import { Check, User } from "lucide-react";
import { tandaiBayarBonus } from "./actions";
import { formatRupiah } from "@/lib/utils";
import { DetailModal } from "@/components/DetailModal";

export type KurirSummary = {
  kurirUserId: string;
  kurirNama: string;
  kurirRole: string;
  pendingTotal: number;
  pendingCount: number;
  paidTotal: number;
  totalGalon: number;
};

export type BonusRow = {
  id: number;
  orderId: number;
  kurirNama: string;
  nomorOrder: string;
  jumlahGalon: number;
  ratePerGalon: number;
  total: number;
  status: string;
  paidAt: string | null;
  createdAt: string;
};

export function BonusClient({
  summary,
  detail,
}: {
  summary: KurirSummary[];
  detail: BonusRow[];
}) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [detailOrderId, setDetailOrderId] = useState<number | null>(null);

  function bayarKurir(k: KurirSummary) {
    if (k.pendingCount === 0) return;
    if (
      !confirm(
        `Tandai semua bonus pending ${k.kurirNama} (${k.pendingCount} order, total ${formatRupiah(
          k.pendingTotal,
        )}) sebagai SUDAH DIBAYAR?`,
      )
    )
      return;
    setMsg(null);
    startTransition(async () => {
      const r = await tandaiBayarBonus(k.kurirUserId);
      if ("error" in r) setMsg(`❌ ${r.error}`);
      else setMsg(`✅ ${r.count} bonus ${k.kurirNama} ditandai dibayar (${formatRupiah(r.total)})`);
    });
  }

  return (
    <div className="space-y-5">
      {/* Per kurir summary */}
      <section>
        <h2 className="text-sm font-bold tracking-widest text-[color:var(--muted)] mb-2">
          PER KURIR
        </h2>
        {summary.length === 0 ? (
          <div className="bg-surface border border-line rounded-2xl p-8 text-center text-[color:var(--muted)] text-sm">
            Belum ada bonus tercatat.
          </div>
        ) : (
          <div className="space-y-2">
            {summary
              .sort((a, b) => b.pendingTotal - a.pendingTotal)
              .map((k) => (
                <div
                  key={k.kurirUserId}
                  className="bg-surface border border-line rounded-2xl p-4 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="font-bold inline-flex items-center gap-1.5">
                      <User size={14} className="text-brand" /> {k.kurirNama}
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[color:var(--surface2)] text-[color:var(--muted)] font-bold">
                        {k.kurirRole}
                      </span>
                    </div>
                    <div className="text-xs text-[color:var(--muted)] mt-1">
                      Total {k.totalGalon} galon · {k.pendingCount} pending order
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
                    onClick={() => bayarKurir(k)}
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

      {/* Detail history */}
      <section>
        <h2 className="text-sm font-bold tracking-widest text-[color:var(--muted)] mb-2">
          HISTORY (100 TERBARU)
        </h2>
        <div className="bg-surface border border-line rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[color:var(--surface2)] text-[color:var(--muted)] text-left">
              <tr>
                <th className="p-3">Tanggal</th>
                <th className="p-3">Kurir</th>
                <th className="p-3 hidden sm:table-cell">Order</th>
                <th className="p-3 text-right hidden sm:table-cell">Galon</th>
                <th className="p-3 text-right">Bonus</th>
                <th className="p-3 hidden sm:table-cell">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {detail.map((d) => (
                <tr
                  key={d.id}
                  onClick={() => setDetailOrderId(d.orderId)}
                  className="hover:bg-[color:var(--surface2)] cursor-pointer"
                >
                  <td className="p-3 text-xs">
                    {new Date(d.createdAt).toLocaleDateString("id-ID", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="p-3 text-sm font-medium">
                    {d.kurirNama}
                    <div className="sm:hidden text-[10px] font-mono text-brand mt-0.5">
                      {d.nomorOrder}
                    </div>
                    <div className="sm:hidden text-[10px] text-[color:var(--muted)] mt-0.5">
                      {d.jumlahGalon} galon · {d.status.toUpperCase()}
                    </div>
                  </td>
                  <td className="p-3 text-xs font-mono text-brand hidden sm:table-cell">{d.nomorOrder}</td>
                  <td className="p-3 text-right text-sm hidden sm:table-cell">{d.jumlahGalon}</td>
                  <td className="p-3 text-right text-sm font-bold">{formatRupiah(d.total)}</td>
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
                  <td colSpan={6} className="p-8 text-center text-[color:var(--muted)]">
                    Belum ada history.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </div>
      </section>

      {detailOrderId !== null && (
        <DetailModal
          kind="order"
          id={detailOrderId}
          onClose={() => setDetailOrderId(null)}
        />
      )}
    </div>
  );
}
