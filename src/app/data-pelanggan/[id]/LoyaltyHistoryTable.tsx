"use client";

import { useState } from "react";
import { formatRupiah } from "@/lib/utils";
import { DetailModal } from "@/components/DetailModal";

type Mutasi = {
  id: number;
  tipe: string;
  jumlah: number;
  deskripsi: string | null;
  refOrderId: number | null;
  refTransaksiId: number | null;
  createdAt: string;
};

const TIPE_LABEL: Record<string, { label: string; color: string }> = {
  earn: { label: "Earn", color: "text-emerald-600" },
  redeem: { label: "Redeem", color: "text-red-600" },
  referral_in: { label: "Referral", color: "text-blue-600" },
  referral_bonus: { label: "Bonus Referral", color: "text-blue-600" },
  stamp_reward: { label: "Stamp", color: "text-amber-600" },
  adjust: { label: "Adjust", color: "text-purple-600" },
};

export function LoyaltyHistoryTable({ mutasi }: { mutasi: Mutasi[] }) {
  const [detail, setDetail] = useState<
    { kind: "order" | "transaksi"; id: number } | null
  >(null);

  function handleClick(m: Mutasi) {
    if (m.refOrderId) setDetail({ kind: "order", id: m.refOrderId });
    else if (m.refTransaksiId) setDetail({ kind: "transaksi", id: m.refTransaksiId });
  }

  return (
    <>
      <table className="w-full text-sm">
        <thead className="bg-[color:var(--surface2)] text-[color:var(--muted)] text-left text-xs">
          <tr>
            <th className="p-3">Tanggal</th>
            <th className="p-3">Tipe</th>
            <th className="p-3">Deskripsi</th>
            <th className="p-3 text-right">Jumlah</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {mutasi.map((m) => {
            const tipe = TIPE_LABEL[m.tipe] ?? {
              label: m.tipe,
              color: "text-[color:var(--muted)]",
            };
            const hasRef = !!(m.refOrderId || m.refTransaksiId);
            return (
              <tr
                key={m.id}
                onClick={() => hasRef && handleClick(m)}
                className={
                  hasRef ? "cursor-pointer hover:bg-[color:var(--surface2)]" : ""
                }
                title={hasRef ? "Klik untuk lihat detail order/transaksi" : ""}
              >
                <td className="p-3 text-xs whitespace-nowrap">
                  {new Date(m.createdAt).toLocaleString("id-ID", {
                    day: "2-digit",
                    month: "short",
                    year: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </td>
                <td className={`p-3 text-xs font-bold ${tipe.color}`}>{tipe.label}</td>
                <td className="p-3 text-xs text-[color:var(--muted)] max-w-xs truncate">
                  {m.deskripsi ?? "-"}
                  {hasRef && <span className="ml-1 text-brand">›</span>}
                </td>
                <td
                  className={`p-3 text-right font-mono font-bold whitespace-nowrap ${
                    m.jumlah > 0 ? "text-emerald-600" : "text-red-600"
                  }`}
                >
                  {m.jumlah > 0 ? "+" : ""}
                  {formatRupiah(m.jumlah)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {detail && (
        <DetailModal kind={detail.kind} id={detail.id} onClose={() => setDetail(null)} />
      )}
    </>
  );
}
