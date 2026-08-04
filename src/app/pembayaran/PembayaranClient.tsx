"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, X, ExternalLink, FileText, ChevronDown, ChevronRight, FileStack, Unlink, Loader2 } from "lucide-react";
import { konfirmasiBayar, tolakBayar, bayarPiutangPartial } from "./actions";
import { batalkanOrderPiutang } from "@/app/kasir/order/actions";
import { tandaiLunasBatch, lepasNotaGabungan } from "../admin/nota-gabungan/actions";
import { formatRupiah } from "@/lib/utils";
import { normalizeDriveUrl, isPdfUrl } from "@/lib/drive-url";
import { DetailModal } from "@/components/DetailModal";
import { useToast } from "@/components/Toast";
import { RupiahInput } from "@/components/RupiahInput";

export type Row = {
  id: number;
  nomorOrder: string;
  total: number;
  paidPartial: number;
  metode: string | null;
  status: string; // statusBayar: belum | menunggu | lunas
  statusOrder: string;
  buktiUrl: string | null;
  bayarAt: string | null;
  diantarAt: string | null;
  selesaiAt: string | null;
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

export function PembayaranClient({
  rows,
  piutangThresholdHari = 30,
}: {
  rows: Row[];
  piutangThresholdHari?: number;
}) {
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const [detailId, setDetailId] = useState<number | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());

  function isPiutang(r: Row) {
    return r.statusOrder === "selesai" && r.status === "belum";
  }
  function sisaPiutang(r: Row): number {
    return Math.max(0, r.total - r.paidPartial);
  }
  const [bayarPartialFor, setBayarPartialFor] = useState<Row | null>(null);

  function umurHari(r: Row): number {
    const ref = r.selesaiAt ?? r.diantarAt ?? r.createdAt;
    const ms = Date.now() - new Date(ref).getTime();
    return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));
  }

  function isMenua(r: Row): boolean {
    if (!isPiutang(r) || piutangThresholdHari === 0) return false;
    return umurHari(r) >= piutangThresholdHari;
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

      {bayarPartialFor && (
        <CicilanModal
          row={bayarPartialFor}
          onClose={() => setBayarPartialFor(null)}
          onDone={(r) => {
            if (r.lunas) toast.show(`✓ Lunas penuh — ${formatRupiah(r.totalDibayar)}`);
            else toast.show(`💵 Cicilan ${formatRupiah(r.totalDibayar)} dicatat. Sisa ${formatRupiah(r.sisaPiutang)}`);
            setBayarPartialFor(null);
          }}
        />
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
                {isPiutang(r) && (
                  <div className="mt-1 space-y-1">
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                        isMenua(r)
                          ? "bg-red-600 text-white animate-pulse"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      🕒 {umurHari(r)} hari{isMenua(r) ? " · MENUA" : ""}
                    </span>
                    {r.paidPartial > 0 && (
                      <div className="text-[10px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 inline-block">
                        💵 Cicilan: {formatRupiah(r.paidPartial)} / {formatRupiah(r.total)} · Sisa{" "}
                        <b>{formatRupiah(sisaPiutang(r))}</b>
                      </div>
                    )}
                  </div>
                )}
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
                  <Check size={14} /> {isPiutang(r) ? "Lunas Penuh" : "Konfirmasi Lunas"}
                </button>
                {/* Tombol bayar sebagian (cicilan) — hanya untuk piutang */}
                {isPiutang(r) && (
                  <button
                    disabled={pending}
                    onClick={() => setBayarPartialFor(r)}
                    className="px-3 py-2.5 border-2 border-amber-300 text-amber-700 rounded-xl text-sm font-bold inline-flex items-center justify-center gap-1 disabled:opacity-50"
                    title="Bayar sebagian / cicilan"
                  >
                    Cicilan
                  </button>
                )}
                {/* Tombol batalkan piutang — kasir salah input (mis. tipe pengantaran) */}
                {isPiutang(r) && r.paidPartial === 0 && (
                  <button
                    disabled={pending}
                    onClick={() => {
                      const alasan = prompt(
                        `BATALKAN order piutang ${r.nomorOrder} (${formatRupiah(r.total)})?\n\nUntuk kasus kasir salah input (mis. tipe pengantaran salah, salah item). Stok akan otomatis dikembalikan.\n\nAlasan (wajib, min 3 karakter):`,
                      );
                      if (!alasan || alasan.trim().length < 3) return;
                      startTransition(async () => {
                        const res = await batalkanOrderPiutang(r.id, alasan.trim());
                        if ("error" in res) toast.show(`❌ ${res.error}`);
                        else toast.show(`✓ ${r.nomorOrder} dibatalkan, stok dikembalikan`);
                      });
                    }}
                    className="px-3 py-2.5 border-2 border-red-200 text-red-600 rounded-xl text-sm font-bold inline-flex items-center justify-center gap-1 disabled:opacity-50"
                    title="Batal order — kasir salah input"
                  >
                    <X size={14} />
                  </button>
                )}
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

function CicilanModal({
  row,
  onClose,
  onDone,
}: {
  row: Row;
  onClose: () => void;
  onDone: (r: { lunas: boolean; sisaPiutang: number; totalDibayar: number }) => void;
}) {
  const sisaSekarang = Math.max(0, row.total - row.paidPartial);
  const [jumlah, setJumlah] = useState(String(sisaSekarang));
  const [catatan, setCatatan] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const jumlahNum = Math.max(0, Math.floor(Number(jumlah) || 0));
  const dialokasikan = Math.min(jumlahNum, sisaSekarang);
  const akanLunas = dialokasikan >= sisaSekarang;
  const sisaSetelah = Math.max(0, sisaSekarang - dialokasikan);

  const presetButtons = [
    { label: "Lunas", value: sisaSekarang },
    { label: "1/2", value: Math.floor(sisaSekarang / 2) },
    { label: "Bulat 50k", value: Math.floor(sisaSekarang / 50000) * 50000 },
    { label: "Bulat 10k", value: Math.floor(sisaSekarang / 10000) * 10000 },
    { label: "Bulat 5k", value: Math.floor(sisaSekarang / 5000) * 5000 },
  ].filter((p) => p.value > 0 && p.value <= sisaSekarang);

  function submit() {
    setError(null);
    if (jumlahNum <= 0) {
      setError("Jumlah bayar harus > 0");
      return;
    }
    startTransition(async () => {
      const r = await bayarPiutangPartial({
        orderId: row.id,
        jumlahBayar: jumlahNum,
        catatan: catatan.trim() || undefined,
      });
      if ("error" in r) setError(r.error);
      else onDone({ lunas: r.lunas, sisaPiutang: r.sisaPiutang, totalDibayar: r.totalDibayar });
    });
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 grid place-items-center p-4">
      <div className="bg-surface rounded-2xl max-w-md w-full p-5 space-y-3">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="font-bold text-lg">Bayar Cicilan</h2>
            <div className="text-xs text-[color:var(--muted)] mt-0.5">
              {row.nomorOrder} · {row.pelangganNama ?? "—"}
            </div>
          </div>
          <button onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-[color:var(--muted)]">Total piutang</span>
            <b>{formatRupiah(row.total)}</b>
          </div>
          {row.paidPartial > 0 && (
            <div className="flex justify-between">
              <span className="text-[color:var(--muted)]">Sudah dibayar</span>
              <b className="text-emerald-700">{formatRupiah(row.paidPartial)}</b>
            </div>
          )}
          <div className="flex justify-between pt-1 border-t border-amber-200 font-bold">
            <span>Sisa sekarang</span>
            <span className="text-amber-800">{formatRupiah(sisaSekarang)}</span>
          </div>
        </div>

        <div>
          <label className="text-xs font-bold block mb-1">Jumlah Bayar (Rp)</label>
          <RupiahInput
            value={jumlah}
            onChange={setJumlah}
            autoFocus
            className="w-full px-3 py-2 border border-line rounded-md text-lg font-mono"
          />
          <div className="flex gap-1.5 mt-2 flex-wrap">
            {presetButtons.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => setJumlah(String(p.value))}
                className="px-2 py-1 text-[11px] border border-line rounded-md hover:border-brand"
              >
                {p.label}: {formatRupiah(p.value)}
              </button>
            ))}
          </div>
        </div>

        <div
          className={`rounded-xl p-3 text-sm font-bold ${
            akanLunas
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-amber-50 text-amber-800 border border-amber-200"
          }`}
        >
          {akanLunas ? (
            <>✓ LUNAS PENUH setelah bayar ini</>
          ) : (
            <>
              💵 Cicilan {formatRupiah(dialokasikan)} · Sisa pending{" "}
              <b>{formatRupiah(sisaSetelah)}</b>
            </>
          )}
        </div>

        <div>
          <label className="text-xs font-bold block mb-1">Catatan (opsional)</label>
          <input
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            placeholder="mis: bayar sebagian, sisa minggu depan"
            className="w-full px-3 py-2 border border-line rounded-md text-sm"
          />
        </div>

        {error && <div className="text-xs text-red-600">{error}</div>}

        <div className="flex justify-end gap-2 pt-2 border-t border-line">
          <button
            onClick={onClose}
            disabled={pending}
            className="px-4 py-2 border border-line rounded-md text-sm"
          >
            Batal
          </button>
          <button
            onClick={submit}
            disabled={pending || jumlahNum <= 0}
            className="px-4 py-2 bg-emerald-600 text-white rounded-md text-sm font-bold inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            {pending && <Loader2 size={14} className="animate-spin" />}
            Catat Pembayaran
          </button>
        </div>
      </div>
    </div>
  );
}
