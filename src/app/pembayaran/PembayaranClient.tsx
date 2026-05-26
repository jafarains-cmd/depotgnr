"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, X, ExternalLink, FileText, ChevronDown, ChevronRight, FileStack, Unlink } from "lucide-react";
import { konfirmasiBayar, tolakBayar } from "./actions";
import { tandaiLunasBatch, lepasNotaGabungan } from "../admin/nota-gabungan/actions";
import { formatRupiah } from "@/lib/utils";
import { normalizeDriveUrl, isPdfUrl } from "@/lib/drive-url";
import { DetailModal } from "@/components/DetailModal";
import { useToast } from "@/components/Toast";

export type Row = {
  id: number;
  nomorOrder: string;
  total: number;
  metode: string | null;
  status: string; // statusBayar: belum | menunggu | lunas
  statusOrder: string;
  buktiUrl: string | null;
  bayarAt: string | null;
  diantarAt: string | null;
  createdAt: string;
  pelangganNama: string | null;
  pelangganTelp: string | null;
  notaGabunganId: number | null;
  notaGabunganKode: string | null;
  pembuatNama: string | null;
  konfirmasiNama: string | null;
};

type Item =
  | { kind: "single"; row: Row }
  | { kind: "group"; id: number; kode: string; rows: Row[]; sortKey: string };

export function PembayaranClient({ rows }: { rows: Row[] }) {
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const [detailId, setDetailId] = useState<number | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());

  function isPiutang(r: Row) {
    return r.statusOrder === "selesai" && r.status === "belum";
  }

  // Group rows: row dengan notaGabunganId yang sama jadi 1 group item.
  // Single (notaGabunganId=null) tetap standalone.
  const items: Item[] = useMemo(() => {
    const groups = new Map<number, { kode: string; rows: Row[] }>();
    const singles: Row[] = [];
    for (const r of rows) {
      if (r.notaGabunganId && r.notaGabunganKode) {
        const g = groups.get(r.notaGabunganId);
        if (g) g.rows.push(r);
        else groups.set(r.notaGabunganId, { kode: r.notaGabunganKode, rows: [r] });
      } else {
        singles.push(r);
      }
    }
    const all: Item[] = [
      ...[...groups.entries()].map(([id, g]) => ({
        kind: "group" as const,
        id,
        kode: g.kode,
        rows: g.rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
        sortKey: g.rows
          .map((r) => r.createdAt)
          .sort()
          .reverse()[0],
      })),
      ...singles.map((r) => ({ kind: "single" as const, row: r, sortKey: r.createdAt })),
    ];
    // Sortir descending by sortKey supaya yang baru di atas (match query default)
    all.sort((a, b) => {
      const sa = a.kind === "group" ? a.sortKey : a.row.createdAt;
      const sb = b.kind === "group" ? b.sortKey : b.row.createdAt;
      return sb.localeCompare(sa);
    });
    return all;
  }, [rows]);

  function toggleGroup(id: number) {
    setExpandedGroups((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleTandaiGrup(g: { id: number; kode: string; rows: Row[] }) {
    const belumLunas = g.rows.filter((r) => r.status !== "lunas");
    if (belumLunas.length === 0) return;
    if (
      !confirm(
        `Tandai SEMUA ${belumLunas.length} order di grup ${g.kode} sebagai LUNAS? Total: ${formatRupiah(
          belumLunas.reduce((s, r) => s + r.total, 0),
        )}. Pastikan pelanggan sudah benar-benar bayar semua.`,
      )
    )
      return;
    startTransition(async () => {
      await tandaiLunasBatch(belumLunas.map((r) => r.id));
    });
  }

  function handleLepasGrup(g: { id: number; kode: string }) {
    if (
      !confirm(
        `Lepas grup ${g.kode}? Order-order di dalamnya akan kembali jadi piutang per-order. Tidak bisa lepas kalau sudah ada yang dibayar.`,
      )
    )
      return;
    startTransition(async () => {
      const r = await lepasNotaGabungan(g.id);
      if ("error" in r) toast.error(r.error);
      else toast.success(`Grup ${g.kode} dilepas`);
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid lg:grid-cols-2 gap-3">
        {items.map((item) =>
          item.kind === "group" ? (
            <GroupCard
              key={`grup-${item.id}`}
              group={item}
              expanded={expandedGroups.has(item.id)}
              onToggle={() => toggleGroup(item.id)}
              onTandaiLunas={() => handleTandaiGrup(item)}
              onLepas={() => handleLepasGrup(item)}
              onOpenDetail={(id) => setDetailId(id)}
              pending={pending}
            />
          ) : (
            renderSingleRow(item.row)
          ),
        )}
        {items.length === 0 && (
          <div className="lg:col-span-2 p-10 text-center text-[color:var(--muted)] bg-surface rounded-2xl border border-line">
            Tidak ada data.
          </div>
        )}
      </div>

      {detailId !== null && (
        <DetailModal kind="order" id={detailId} onClose={() => setDetailId(null)} />
      )}
    </div>
  );

  function renderSingleRow(r: Row) {
    return (
          <div
            key={r.id}
            className="bg-surface border border-line rounded-2xl p-4 space-y-3"
            style={{
              borderLeftWidth: 4,
              borderLeftColor:
                r.status === "lunas"
                  ? "#22C55E"
                  : isPiutang(r)
                    ? "#EF4444" // merah untuk piutang
                    : "var(--accent)",
            }}
          >
            <button
              type="button"
              onClick={() => setDetailId(r.id)}
              className="flex justify-between items-start gap-2 w-full text-left hover:opacity-80 transition"
            >
              <div className="min-w-0">
                <div className="font-mono text-xs text-[color:var(--muted)]">
                  {r.nomorOrder}
                </div>
                <div className="font-extrabold truncate">{r.pelangganNama ?? "-"}</div>
                {r.pelangganTelp && (
                  <div className="text-xs text-[color:var(--muted)]">{r.pelangganTelp}</div>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-lg font-extrabold text-brand">{formatRupiah(r.total)}</div>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    r.status === "lunas"
                      ? "bg-emerald-100 text-emerald-800"
                      : isPiutang(r)
                        ? "bg-red-100 text-red-800"
                        : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {(r.metode ?? "-").toUpperCase()} ·{" "}
                  {isPiutang(r) ? "PIUTANG" : r.status.toUpperCase()}
                </span>
                {r.diantarAt && r.statusOrder === "selesai" && (
                  <div className="text-[10px] text-[color:var(--muted)] mt-1">
                    Diantar:{" "}
                    {new Date(r.diantarAt).toLocaleDateString("id-ID", {
                      day: "2-digit",
                      month: "short",
                      timeZone: "Asia/Makassar",
                    })}
                  </div>
                )}
              </div>
            </button>

            {/* Info kasir pembuat + petugas konfirmasi */}
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[10px] text-[color:var(--muted)]">
              {r.pembuatNama && (
                <span>Dibuat: <b className="text-ink">{r.pembuatNama}</b></span>
              )}
              {r.konfirmasiNama && (
                <span>Konfirmasi: <b className="text-ink">{r.konfirmasiNama}</b></span>
              )}
            </div>

            {r.buktiUrl && (
              <div>
                <div className="text-[10px] text-[color:var(--muted)] mb-1.5 font-semibold uppercase tracking-wide">
                  Bukti Pembayaran
                </div>
                {isPdfUrl(r.buktiUrl) ? (
                  <a
                    href={r.buktiUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block w-full p-6 rounded-xl border border-line bg-[color:var(--surface2)] text-center hover:border-brand transition"
                  >
                    <FileText size={32} className="mx-auto mb-2 text-brand" />
                    <div className="text-sm font-bold text-ink">Bukti PDF</div>
                    <div className="text-xs text-[color:var(--muted)]">Klik untuk buka</div>
                  </a>
                ) : (
                  <a href={r.buktiUrl} target="_blank" rel="noreferrer" className="block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={normalizeDriveUrl(r.buktiUrl)}
                      alt="Bukti"
                      className="w-full max-h-64 object-contain rounded-xl border border-line bg-[color:var(--surface2)]"
                    />
                  </a>
                )}
                <a
                  href={r.buktiUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-brand font-bold inline-flex items-center gap-1 mt-2"
                >
                  <ExternalLink size={11} /> Buka di tab baru
                </a>
              </div>
            )}

            {(r.status === "menunggu" || isPiutang(r)) && (
              <div className="flex gap-2 pt-3 border-t border-line">
                <button
                  disabled={pending}
                  onClick={() => {
                    let msg: string;
                    if (isPiutang(r)) {
                      msg = r.buktiUrl
                        ? `⚠ MOHON PERIKSA BUKTI PEMBAYARAN dulu di card ini sebelum menandai lunas.\n\nTandai LUNAS piutang ${r.nomorOrder} (${formatRupiah(r.total)})?`
                        : `ℹ BELUM ADA BUKTI PEMBAYARAN dari pelanggan.\n\nLanjut tandai LUNAS piutang ${r.nomorOrder} (${formatRupiah(r.total)})? Pastikan pelanggan sudah benar-benar bayar.`;
                    } else {
                      msg = `⚠ MOHON PERIKSA BUKTI PEMBAYARAN dulu di card ini sebelum konfirmasi.\n\nKonfirmasi pembayaran ${r.nomorOrder} sebesar ${formatRupiah(r.total)}?`;
                    }
                    if (confirm(msg)) {
                      startTransition(async () => {
                        await konfirmasiBayar(r.id);
                      });
                    }
                  }}
                  className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-extrabold inline-flex items-center justify-center gap-1.5 disabled:opacity-50 active:scale-[0.98] transition"
                >
                  <Check size={14} /> {isPiutang(r) ? "Tandai Lunas" : "Konfirmasi Lunas"}
                </button>
                {/* Tombol tolak hanya untuk yang punya bukti (statusBayar=menunggu) */}
                {r.status === "menunggu" && (
                  <button
                    disabled={pending}
                    onClick={() => {
                      const alasan = prompt("Alasan tolak (opsional):") ?? "";
                      if (confirm(`Tolak bukti pembayaran ${r.nomorOrder}?`)) {
                        startTransition(async () => {
                          await tolakBayar(r.id, alasan);
                        });
                      }
                    }}
                    className="px-3 py-2.5 border-2 border-rose-200 text-rose-600 rounded-xl text-sm font-bold inline-flex items-center justify-center gap-1 disabled:opacity-50"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            )}

            {r.status === "lunas" && r.bayarAt && (
              <div className="text-[11px] text-[color:var(--muted)] pt-3 border-t border-line">
                ✓ Lunas{" "}
                {new Date(r.bayarAt).toLocaleString("id-ID", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
                {r.konfirmasiNama && (
                  <span> · oleh <b>{r.konfirmasiNama}</b></span>
                )}
              </div>
            )}
            {r.notaGabunganKode && (
              <div className="text-[10px] text-violet-700 bg-violet-50 rounded px-2 py-1 font-bold">
                📎 Bagian dari grup {r.notaGabunganKode}
              </div>
            )}
          </div>
    );
  }
}

function GroupCard({
  group,
  expanded,
  onToggle,
  onTandaiLunas,
  onLepas,
  onOpenDetail,
  pending,
}: {
  group: { id: number; kode: string; rows: Row[] };
  expanded: boolean;
  onToggle: () => void;
  onTandaiLunas: () => void;
  onLepas: () => void;
  onOpenDetail: (id: number) => void;
  pending: boolean;
}) {
  const totalGabungan = group.rows.reduce((s, r) => s + r.total, 0);
  const belumLunasCount = group.rows.filter((r) => r.status !== "lunas").length;
  const allLunas = belumLunasCount === 0;
  const pelangganNama = group.rows[0]?.pelangganNama ?? "-";
  const pelangganTelp = group.rows[0]?.pelangganTelp ?? null;

  return (
    <div
      className="bg-surface border border-line rounded-2xl p-4 space-y-3 lg:col-span-2"
      style={{
        borderLeftWidth: 4,
        borderLeftColor: allLunas ? "#22C55E" : "#7C3AED",
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={onToggle}
          className="flex items-start gap-2 text-left hover:opacity-80 flex-1"
        >
          {expanded ? (
            <ChevronDown size={18} className="mt-0.5 flex-shrink-0 text-violet-600" />
          ) : (
            <ChevronRight size={18} className="mt-0.5 flex-shrink-0 text-violet-600" />
          )}
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold tracking-widest text-violet-700 inline-flex items-center gap-1">
              <FileStack size={11} /> NOTA GABUNGAN · {group.kode}
            </div>
            <div className="font-extrabold truncate">{pelangganNama}</div>
            {pelangganTelp && (
              <div className="text-xs text-[color:var(--muted)]">{pelangganTelp}</div>
            )}
            <div className="text-xs text-[color:var(--muted)] mt-0.5">
              {group.rows.length} order ·{" "}
              {allLunas ? "semua lunas" : `${belumLunasCount} belum lunas`}
            </div>
          </div>
        </button>
        <div className="text-right flex-shrink-0">
          <div className="text-lg font-extrabold text-violet-700">
            {formatRupiah(totalGabungan)}
          </div>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
              allLunas
                ? "bg-emerald-100 text-emerald-800"
                : "bg-violet-100 text-violet-800"
            }`}
          >
            {allLunas ? "LUNAS GRUP" : "PIUTANG GRUP"}
          </span>
        </div>
      </div>

      {expanded && (
        <div className="space-y-1 border-t border-line pt-3">
          {group.rows.map((r) => (
            <button
              type="button"
              key={r.id}
              onClick={() => onOpenDetail(r.id)}
              className="w-full flex items-center justify-between text-left px-2 py-1.5 rounded-md hover:bg-[color:var(--surface2)] text-xs"
            >
              <span className="font-mono text-brand">{r.nomorOrder}</span>
              <span className="flex items-center gap-2">
                <span className="text-[color:var(--muted)]">
                  {new Date(r.createdAt).toLocaleDateString("id-ID", {
                    day: "2-digit",
                    month: "short",
                  })}
                </span>
                <span className="font-bold">{formatRupiah(r.total)}</span>
                <span
                  className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                    r.status === "lunas"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {r.status.toUpperCase()}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2 pt-2 border-t border-line">
        {!allLunas && (
          <button
            disabled={pending}
            onClick={onTandaiLunas}
            className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-extrabold inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <Check size={14} /> Tandai Semua Lunas
          </button>
        )}
        {!allLunas && (
          <button
            disabled={pending}
            onClick={onLepas}
            className="px-3 py-2.5 border-2 border-line text-[color:var(--muted)] rounded-xl text-xs font-bold inline-flex items-center gap-1 disabled:opacity-50"
            title="Lepas gabungan — order kembali jadi piutang per-order"
          >
            <Unlink size={12} /> Lepas
          </button>
        )}
        <a
          href={`/admin/nota-gabungan/cetak?ids=${group.rows.map((r) => r.id).join(",")}`}
          className="px-3 py-2.5 border-2 border-violet-200 text-violet-700 rounded-xl text-xs font-bold inline-flex items-center gap-1"
        >
          <FileText size={12} /> Cetak
        </a>
      </div>
    </div>
  );
}
