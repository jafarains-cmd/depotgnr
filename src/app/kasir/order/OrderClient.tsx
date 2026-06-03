"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { formatRupiah } from "@/lib/utils";
import { normalizeDriveUrl } from "@/lib/drive-url";
import { updateOrderStatus, assignKurir } from "./actions";
import { BuktiAntarUpload } from "./BuktiAntarUpload";
import { useFormatTanggal } from "@/components/TimezoneContext";

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

/**
 * Warna border kiri card berdasarkan status — supaya in-flight orders
 * mudah dibedakan dari yang sudah selesai/batal saat tab 'Semua'.
 */
const STATUS_BORDER: Record<OrderStatus, string> = {
  pending: "#F59E0B", // amber — butuh ditindak (badge trigger)
  diproses: "#2563EB", // blue
  dijemput: "#4F46E5", // indigo
  diisi: "#0891B2", // cyan
  diantar: "#7E22CE", // purple
  selesai: "#10B981", // emerald (subtle)
  batal: "#94A3B8", // slate (faded)
};

/**
 * Background tint card untuk status yang butuh attention.
 * pending = paling jelas (alert), in-progress = subtle, selesai/batal = transparan.
 */
const STATUS_BG: Record<OrderStatus, string> = {
  pending: "bg-amber-50",
  diproses: "bg-blue-50/30",
  dijemput: "bg-indigo-50/30",
  diisi: "bg-cyan-50/30",
  diantar: "bg-purple-50/30",
  selesai: "bg-surface",
  batal: "bg-surface opacity-70",
};

export function OrderClient({
  rows,
  kurirList,
  isAdmin = false,
  statusFilter = "all",
}: {
  rows: OrderRow[];
  kurirList: { id: string; name: string }[];
  isAdmin?: boolean;
  statusFilter?: string;
}) {
  const [pending, startTransition] = useTransition();
  const filter = statusFilter as OrderStatus | "all" | "aktif" | "tuntas";
  const [assignError, setAssignError] = useState<{ orderId: number; msg: string } | null>(null);
  const fmt = useFormatTanggal();

  function handleAssignKurir(orderId: number, newKurirId: string | null, isCompleted: boolean) {
    if (isCompleted) {
      const ok = confirm(
        "Order ini sudah selesai dan bonus sudah tercatat. Reassign akan reverse bonus lama dan catat bonus baru ke kurir baru. Lanjut?",
      );
      if (!ok) return;
    }
    setAssignError(null);
    startTransition(async () => {
      const r = await assignKurir(orderId, newKurirId);
      if (r && "error" in r) {
        setAssignError({ orderId, msg: r.error });
      }
    });
  }

  // Priority sort: in-flight orders (pending, diproses, dll) di atas,
  // selesai/batal di bawah. Dalam grup, urutan asli (createdAt desc) dipertahankan.
  const STATUS_PRIORITY: Record<OrderStatus, number> = {
    pending: 0,
    diproses: 1,
    dijemput: 2,
    diisi: 3,
    diantar: 4,
    selesai: 5,
    batal: 6,
  };
  // Filter status sudah diterapkan di SQL (server-side). Sort untuk tab "all"
  // dan "aktif" tetap di client supaya pending muncul dulu.
  const filtered =
    filter === "all" || filter === "aktif"
      ? [...rows].sort(
          (a, b) => STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status],
        )
      : rows;

  const TAB_LABEL: Record<string, string> = {
    aktif: "Aktif",
    all: "Semua",
    pending: "pending",
    diproses: "diproses",
    dijemput: "dijemput",
    diisi: "diisi",
    diantar: "diantar",
    selesai: "selesai",
    tuntas: "Tuntas",
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-1 text-sm flex-wrap">
        {(["aktif", "pending", "diproses", "dijemput", "diisi", "diantar", "selesai", "tuntas", "all"] as const).map((f) => (
          <Link
            key={f}
            href={`/kasir/order?status=${f}`}
            className={`px-3 py-1.5 rounded-md ${
              filter === f ? "bg-brand-600 text-white" : "bg-surface border border-line"
            }`}
          >
            {TAB_LABEL[f]}
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-3">
        {filtered.map((o) => {
          const next = nextStatus(o);
          return (
            <div
              key={o.id}
              className={`rounded-xl border border-line p-4 space-y-2 ${STATUS_BG[o.status]}`}
              style={{
                borderLeftWidth: 4,
                borderLeftColor: STATUS_BORDER[o.status],
              }}
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-mono text-xs text-[color:var(--muted)]">{o.nomorOrder}</div>
                  <div className="font-medium">
                    {o.pelangganNama ?? "Tanpa Akun"}{" "}
                    <span className="text-xs text-[color:var(--muted)]">{o.pelangganTelp}</span>
                  </div>
                  <div className="text-[11px] text-[color:var(--muted)] mt-0.5">
                    🕒 Order:{" "}
                    {fmt(o.createdAt, {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {o.selesaiAt && (
                      <>
                        {" · ✅ Selesai: "}
                        {fmt(o.selesaiAt, {
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
                    className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase ${STATUS_COLOR[o.status]} ${
                      o.status === "pending" ? "animate-pulse" : ""
                    }`}
                  >
                    {o.status}
                  </span>
                  {(() => {
                    const sb = o.statusBayar;
                    const map: Record<string, { label: string; cls: string }> = {
                      lunas: { label: "LUNAS", cls: "bg-emerald-100 text-emerald-700" },
                      belum: { label: "BELUM LUNAS", cls: "bg-amber-100 text-amber-700" },
                      menunggu: { label: "VERIFIKASI", cls: "bg-blue-100 text-blue-700" },
                    };
                    const cfg = map[sb];
                    if (!cfg) return null;
                    return (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${cfg.cls}`}>
                        {cfg.label}
                      </span>
                    );
                  })()}
                  <span className="text-xs text-[color:var(--muted)]">via {o.sumber}</span>
                  {o.status === "pending" && (
                    <span className="text-[10px] font-bold text-amber-700 uppercase">
                      ⚠ Perlu tindakan
                    </span>
                  )}
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

              {(o.status === "pending" ||
                o.status === "diproses" ||
                o.status === "diantar" ||
                (o.status === "selesai" && isAdmin)) && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-[color:var(--muted)]">Kurir:</span>
                    <select
                      value={o.kurirUserId ?? ""}
                      onChange={(e) =>
                        handleAssignKurir(
                          o.id,
                          e.target.value || null,
                          o.status === "selesai",
                        )
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
                  {o.status === "selesai" && (
                    <div className="text-[10px] text-amber-600">
                      ⚠ Reassign akan reverse bonus lama & catat bonus baru
                    </div>
                  )}
                  {assignError?.orderId === o.id && (
                    <div className="text-[11px] text-red-600">{assignError.msg}</div>
                  )}
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
                      {fmt(o.diantarAt, {
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
                {o.status === "selesai" && o.statusBayar !== "lunas" && (
                  <Link
                    href={`/pembayaran`}
                    className="flex-1 py-1.5 bg-amber-600 text-white rounded-md text-xs text-center font-bold"
                  >
                    💰 Konfirmasi Lunas →
                  </Link>
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
