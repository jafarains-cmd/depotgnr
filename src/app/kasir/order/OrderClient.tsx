"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { formatRupiah } from "@/lib/utils";
import { updateOrderStatus, assignKurir } from "./actions";

export type OrderStatus =
  | "pending"
  | "diproses"
  | "dijemput"
  | "diisi"
  | "diantar"
  | "selesai"
  | "batal";

export type OrderRow = {
  id: number;
  nomorOrder: string;
  sumber: string;
  status: OrderStatus;
  tipePengantaran: "antar-saja" | "jemput-antar";
  alamatAntar: string | null;
  jadwalAntar: string | null;
  totalEstimasi: number;
  catatan: string | null;
  createdAt: string;
  buktiFotoUrl: string | null;
  buktiJemputUrl: string | null;
  diantarAt: string | null;
  kurirUserId: string | null;
  pelangganNama: string | null;
  pelangganTelp: string | null;
  items: { qty: number; jenis: string; namaProduk: string }[];
};

function nextStatus(row: OrderRow): OrderStatus | null {
  if (row.tipePengantaran === "jemput-antar") {
    switch (row.status) {
      case "pending": return "dijemput";
      case "dijemput": return "diisi";
      case "diisi": return "diantar";
      case "diantar": return "selesai";
      default: return null;
    }
  }
  switch (row.status) {
    case "pending": return "diproses";
    case "diproses": return "diantar";
    case "diantar": return "selesai";
    default: return null;
  }
}

const STATUS_COLOR: Record<OrderStatus, string> = {
  pending: "bg-amber-100 text-amber-700",
  diproses: "bg-blue-100 text-blue-700",
  dijemput: "bg-indigo-100 text-indigo-700",
  diisi: "bg-cyan-100 text-cyan-700",
  diantar: "bg-purple-100 text-purple-700",
  selesai: "bg-emerald-100 text-emerald-700",
  batal: "bg-slate-200 text-slate-600",
};

export function OrderClient({
  rows,
  kurirList,
}: {
  rows: OrderRow[];
  kurirList: { id: string; name: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const [filter, setFilter] = useState<OrderStatus | "all">("all");

  const filtered =
    filter === "all"
      ? rows
      : rows.filter((r) => r.status === (filter as OrderStatus));

  return (
    <div className="space-y-4">
      <div className="flex gap-1 text-sm flex-wrap">
        {(["all", "pending", "diproses", "dijemput", "diisi", "diantar", "selesai"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-md ${
              filter === f ? "bg-brand-600 text-white" : "bg-white border border-slate-200"
            }`}
          >
            {f === "all" ? "Semua" : f}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-3">
        {filtered.map((o) => {
          const next = nextStatus(o);
          return (
            <div key={o.id} className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-mono text-xs text-slate-500">{o.nomorOrder}</div>
                  <div className="font-medium">
                    {o.pelangganNama ?? "Tanpa Akun"}{" "}
                    <span className="text-xs text-slate-400">{o.pelangganTelp}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[o.status]}`}
                  >
                    {o.status}
                  </span>
                  <span className="text-xs text-slate-400">via {o.sumber}</span>
                </div>
              </div>

              <ul className="text-sm text-slate-700 space-y-0.5">
                {o.items.map((it, i) => (
                  <li key={i}>
                    • {it.qty}× {it.namaProduk}{" "}
                    <span className="text-xs text-slate-500">({it.jenis})</span>
                  </li>
                ))}
              </ul>

              {o.alamatAntar && (
                <div className="text-xs text-slate-500">📍 {o.alamatAntar}</div>
              )}
              {o.catatan && <div className="text-xs italic text-slate-500">"{o.catatan}"</div>}
              <div className="text-sm font-medium">
                Estimasi: {formatRupiah(o.totalEstimasi)}
              </div>

              {(o.status === "pending" || o.status === "diproses" || o.status === "diantar") && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500">Kurir:</span>
                  <select
                    value={o.kurirUserId ?? ""}
                    onChange={(e) =>
                      startTransition(() => assignKurir(o.id, e.target.value || null))
                    }
                    className="flex-1 px-2 py-1 border border-slate-300 rounded text-xs"
                    disabled={pending}
                  >
                    <option value="">— belum di-assign —</option>
                    {kurirList.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {o.buktiFotoUrl && (
                <div className="pt-1">
                  <div className="text-xs text-slate-500 mb-1">Bukti pengantaran:</div>
                  <a href={o.buktiFotoUrl} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={o.buktiFotoUrl}
                      alt="Bukti"
                      className="w-24 h-24 object-cover rounded-md border border-slate-200 hover:opacity-80"
                    />
                  </a>
                  {o.diantarAt && (
                    <div className="text-xs text-slate-400 mt-1">
                      Diantar:{" "}
                      {new Date(o.diantarAt).toLocaleString("id-ID", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2 pt-2 border-t border-slate-100">
                {next && (
                  <button
                    disabled={pending}
                    onClick={() => startTransition(() => updateOrderStatus(o.id, next))}
                    className="flex-1 py-1.5 bg-brand-600 text-white rounded-md text-xs disabled:opacity-50"
                  >
                    Tandai: {next}
                  </button>
                )}
                {o.status === "diantar" && (
                  <Link
                    href={`/kasir/pos?orderId=${o.id}`}
                    className="flex-1 py-1.5 bg-emerald-600 text-white rounded-md text-xs text-center"
                  >
                    Buat Nota
                  </Link>
                )}
                {o.status !== "selesai" && o.status !== "batal" && (
                  <button
                    disabled={pending}
                    onClick={() => {
                      if (confirm(`Batalkan order ${o.nomorOrder}?`)) {
                        startTransition(() => updateOrderStatus(o.id, "batal"));
                      }
                    }}
                    className="px-3 py-1.5 border border-red-200 text-red-600 rounded-md text-xs"
                  >
                    Batal
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="col-span-2 p-8 text-center text-slate-400">Tidak ada order.</div>
        )}
      </div>
    </div>
  );
}
