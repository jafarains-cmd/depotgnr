"use client";

import { useState } from "react";
import { formatRupiah } from "@/lib/utils";
import { DetailModal } from "@/components/DetailModal";
import { Receipt, Truck } from "lucide-react";

export type RiwayatItem = {
  kind: "transaksi" | "order";
  id: number; // id transaksi atau order
  nomor: string;
  createdAt: string;
  total: number;
  statusBayar: string; // lunas | belum | menunggu
  statusOrder?: string; // pending/diantar/selesai/batal (order only)
  metodeBayar: string | null;
  sumber: string; // pos-cash / pos-online / walk-in / web / telegram / whatsapp
  qtyGalon: number;
};

const STATUS_BADGE: Record<string, string> = {
  lunas: "bg-emerald-100 text-emerald-800",
  belum: "bg-rose-100 text-rose-800",
  menunggu: "bg-amber-100 text-amber-800",
};

export function RiwayatTransaksiTable({ items }: { items: RiwayatItem[] }) {
  const [detail, setDetail] = useState<{ kind: "order" | "transaksi"; id: number } | null>(
    null,
  );

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-[color:var(--surface2)] text-[color:var(--muted)] text-left">
            <tr>
              <th className="p-2">Tanggal</th>
              <th className="p-2">Sumber</th>
              <th className="p-2">Nomor</th>
              <th className="p-2 text-right">Galon</th>
              <th className="p-2 text-right">Total</th>
              <th className="p-2">Bayar</th>
              <th className="p-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {items.map((it) => {
              const isOrder = it.kind === "order";
              return (
                <tr
                  key={`${it.kind}-${it.id}`}
                  onClick={() => setDetail({ kind: it.kind, id: it.id })}
                  className="cursor-pointer hover:bg-[color:var(--surface2)]"
                >
                  <td className="p-2 whitespace-nowrap">
                    {new Date(it.createdAt).toLocaleString("id-ID", {
                      day: "2-digit",
                      month: "short",
                      year: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="p-2">
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-bold ${
                        isOrder
                          ? "bg-blue-50 text-blue-700"
                          : "bg-violet-50 text-violet-700"
                      }`}
                    >
                      {isOrder ? <Truck size={10} /> : <Receipt size={10} />}
                      {it.sumber}
                    </span>
                  </td>
                  <td className="p-2 font-mono text-brand">{it.nomor}</td>
                  <td className="p-2 text-right">{it.qtyGalon}</td>
                  <td className="p-2 text-right font-bold">{formatRupiah(it.total)}</td>
                  <td className="p-2 uppercase">{it.metodeBayar ?? "-"}</td>
                  <td className="p-2">
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                        STATUS_BADGE[it.statusBayar] ?? "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {it.statusBayar.toUpperCase()}
                    </span>
                    {it.statusOrder && it.statusOrder !== "selesai" && (
                      <span className="ml-1 text-[10px] text-[color:var(--muted)] uppercase">
                        · {it.statusOrder}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-[color:var(--muted)]">
                  Belum ada transaksi pelanggan ini.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {detail && (
        <DetailModal kind={detail.kind} id={detail.id} onClose={() => setDetail(null)} />
      )}
    </>
  );
}
