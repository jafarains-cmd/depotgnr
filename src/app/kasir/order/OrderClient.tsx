"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { formatRupiah } from "@/lib/utils";
import { normalizeDriveUrl } from "@/lib/drive-url";
import { updateOrderStatus, assignKurir } from "./actions";
import { BuktiAntarUpload } from "./BuktiAntarUpload";

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
  statusBayar: string;
  catatan: string | null;
  createdAt: string;
  buktiFotoUrl: string | null;
  buktiJemputUrl: string | null;
  diantarAt: string | null;
  selesaiAt: string | null;
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
  batal: "bg-[color:var(--surface2)] text-[color:var(--muted)]",
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
              filter === f ? "bg-brand-600 text-white" : "bg-surface border border-line"
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
            <div key={o.id} className="bg-surface rounded-xl border border-line p-4 space-y-2">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-mono text-xs text-[color:var(--muted)]">{o.nomorOrder}</div>
                  <div className="font-medium">
                    {o.pelangganNama ?? "Tanpa Akun"}{" "}
                    <span className="text-xs text-[color:var(--muted)]">{o.pelangganTelp}</span>
                  </div>
                  <div className="text-[11px] text-[color:var(--muted)] mt-0.5">
                    🕒 Order:{" "}
                    {new Date(o.createdAt).toLocaleString("id-ID", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {o.selesaiAt && (
                      <>
                        {" · ✅ Selesai: "}
                        {new Date(o.selesaiAt).toLocaleString("id-ID", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[o.status]}`}
                  >
                    {o.status}
                  </span>
                  <span className="text-xs text-[color:var(--muted)]">via {o.sumber}</span>
                </div>
              </div>

              <ul className="text-sm text-ink space-y-0.5">
                {o.items.map((it, i) => (
                  <li key={i}>
                    • {it.qty}× {it.namaProduk}{" "}
                    <span className="text-xs text-[color:var(--muted)]">({it.jenis})</span>
                  </li>
                ))}
              </ul>

              {o.alamatAntar && (
                <div className="text-xs text-[color:var(--muted)]">📍 {o.alamatAntar}</div>
              )}
              {o.catatan && <div className="text-xs italic text-[color:var(--muted)]">"{o.catatan}"</div>}
              <div className="text-sm font-medium">
                Estimasi: {formatRupiah(o.totalEstimasi)}
              </div>

              {(o.status === "pending" || o.status === "diproses" || o.status === "diantar") && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-[color:var(--muted)]">Kurir:</span>
                  <select
                    value={o.kurirUserId ?? ""}
                    onChange={(e) =>
                      startTransition(() => assignKurir(o.id, e.target.value || null))
                    }
                    className="flex-1 px-2 py-1 border border-line rounded text-xs"
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

              {o.buktiFotoUrl ? (
                <div className="pt-1">
                  <div className="text-xs text-[color:var(--muted)] mb-1">Bukti pengantaran:</div>
                  <a href={o.buktiFotoUrl} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={normalizeDriveUrl(o.buktiFotoUrl)}
                      alt="Bukti"
                      className="w-24 h-24 object-cover rounded-md border border-line hover:opacity-80"
                    />
                  </a>
                  {o.diantarAt && (
                    <div className="text-xs text-[color:var(--muted)] mt-1">
                      Diantar:{" "}
                      {new Date(o.diantarAt).toLocaleString("id-ID", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </div>
                  )}
                  <BuktiAntarUpload orderId={o.id} hasBukti />
                </div>
              ) : (
                (o.status === "diantar" || o.status === "selesai") && (
                  <div className="pt-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md p-2 space-y-1">
                    <div>⚠️ Belum ada bukti foto antar.</div>
                    <BuktiAntarUpload orderId={o.id} hasBukti={false} />
                  </div>
                )
              )}

              <div className="flex gap-2 pt-2 border-t border-line">
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
                {o.status !== "batal" && (
                  <Link
                    href={`/kasir/order/${o.id}/nota`}
                    className="px-3 py-1.5 border border-line text-ink rounded-md text-xs text-center hover:border-brand hover:text-brand"
                  >
                    {o.statusBayar === "lunas" ? "Nota" : "Invoice"}
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
          <div className="col-span-2 p-8 text-center text-[color:var(--muted)]">Tidak ada order.</div>
        )}
      </div>
    </div>
  );
}
