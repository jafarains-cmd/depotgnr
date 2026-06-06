"use client";

import { useState, useTransition } from "react";
import { Check, User, X, Loader2 } from "lucide-react";
import { tandaiBayarBonus, bayarBonusPartialAction } from "./actions";
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
  pelangganNama: string;
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
  const [bayarFor, setBayarFor] = useState<KurirSummary | null>(null);

  function openBayar(k: KurirSummary) {
    if (k.pendingCount === 0) return;
    setMsg(null);
    setBayarFor(k);
  }

  function bayarFull(k: KurirSummary) {
    startTransition(async () => {
      const r = await tandaiBayarBonus(k.kurirUserId);
      if ("error" in r) setMsg(`❌ ${r.error}`);
      else setMsg(`✅ ${r.count} bonus ${k.kurirNama} ditandai dibayar (${formatRupiah(r.total)})`);
      setBayarFor(null);
    });
  }

  function bayarPartial(k: KurirSummary, jumlah: number, catatan: string) {
    startTransition(async () => {
      const r = await bayarBonusPartialAction({
        kurirUserId: k.kurirUserId,
        jumlahBayar: jumlah,
        catatan: catatan || undefined,
      });
      if ("error" in r) setMsg(`❌ ${r.error}`);
      else {
        const sisa = k.pendingTotal - r.totalPaid;
        const sisaText =
          sisa > 0 ? `, sisa ${formatRupiah(sisa)} tetap pending` : "";
        const overText =
          r.sisaTidakTerpakai > 0
            ? ` (kelebihan ${formatRupiah(r.sisaTidakTerpakai)} tidak terpakai)`
            : "";
        setMsg(
          `✅ Bayar ${formatRupiah(r.totalPaid)} ke ${k.kurirNama} — ${r.count} order dilunasi${sisaText}${overText}`,
        );
      }
      setBayarFor(null);
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
                    onClick={() => openBayar(k)}
                    disabled={pending || k.pendingCount === 0}
                    className="flex-shrink-0 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-extrabold inline-flex items-center gap-1.5 disabled:opacity-30 active:scale-[0.98]"
                  >
                    <Check size={14} /> Bayar Bonus
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
                <th className="p-3 hidden md:table-cell">Pelanggan</th>
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
                    <div className="sm:hidden text-[10px] text-[color:var(--muted)] mt-0.5 truncate">
                      {d.pelangganNama}
                    </div>
                    <div className="sm:hidden text-[10px] text-[color:var(--muted)] mt-0.5">
                      {d.jumlahGalon} galon · {d.status.toUpperCase()}
                    </div>
                  </td>
                  <td className="p-3 text-xs font-mono text-brand hidden sm:table-cell">{d.nomorOrder}</td>
                  <td className="p-3 text-xs hidden md:table-cell">{d.pelangganNama}</td>
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
                  <td colSpan={7} className="p-8 text-center text-[color:var(--muted)]">
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

      {bayarFor && (
        <BayarBonusModal
          kurir={bayarFor}
          pending={pending}
          onClose={() => setBayarFor(null)}
          onBayarFull={() => bayarFull(bayarFor)}
          onBayarPartial={(jumlah, catatan) => bayarPartial(bayarFor, jumlah, catatan)}
        />
      )}
    </div>
  );
}

function BayarBonusModal({
  kurir,
  pending,
  onClose,
  onBayarFull,
  onBayarPartial,
}: {
  kurir: KurirSummary;
  pending: boolean;
  onClose: () => void;
  onBayarFull: () => void;
  onBayarPartial: (jumlah: number, catatan: string) => void;
}) {
  const [jumlah, setJumlah] = useState(String(kurir.pendingTotal));
  const [catatan, setCatatan] = useState("");
  const jumlahNum = Math.max(0, Math.floor(Number(jumlah) || 0));
  const sisaSetelahBayar = Math.max(0, kurir.pendingTotal - jumlahNum);
  const overflow = Math.max(0, jumlahNum - kurir.pendingTotal);
  const isFull = jumlahNum === kurir.pendingTotal;

  const presetButtons = [
    { label: "Penuh", value: kurir.pendingTotal },
    { label: "Bulat 50k", value: Math.floor(kurir.pendingTotal / 50000) * 50000 },
    { label: "Bulat 10k", value: Math.floor(kurir.pendingTotal / 10000) * 10000 },
    { label: "Bulat 5k", value: Math.floor(kurir.pendingTotal / 5000) * 5000 },
  ].filter((p) => p.value > 0 && p.value <= kurir.pendingTotal);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 grid place-items-center p-4">
      <div className="bg-surface rounded-2xl max-w-md w-full p-5 space-y-4">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="font-bold text-lg">Bayar Bonus Kurir</h2>
            <div className="text-xs text-[color:var(--muted)] mt-0.5">
              {kurir.kurirNama} · {kurir.pendingCount} order pending
            </div>
          </div>
          <button onClick={onClose} className="text-[color:var(--muted)]">
            <X size={20} />
          </button>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm">
          <div className="text-[10px] font-bold tracking-widest text-amber-800">
            TOTAL PENDING
          </div>
          <div className="text-2xl font-extrabold text-amber-900">
            {formatRupiah(kurir.pendingTotal)}
          </div>
        </div>

        <div>
          <label className="text-xs font-bold block mb-1">Jumlah Bayar (Rp)</label>
          <input
            type="number"
            min={0}
            value={jumlah}
            onChange={(e) => setJumlah(e.target.value)}
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

        <div className="text-xs space-y-0.5 bg-[color:var(--surface2)] rounded-md p-2">
          <div className="flex justify-between">
            <span className="text-[color:var(--muted)]">Dibayar sekarang</span>
            <b>{formatRupiah(Math.min(jumlahNum, kurir.pendingTotal))}</b>
          </div>
          <div className="flex justify-between">
            <span className="text-[color:var(--muted)]">Sisa pending</span>
            <b className="text-amber-700">{formatRupiah(sisaSetelahBayar)}</b>
          </div>
          {overflow > 0 && (
            <div className="flex justify-between text-red-600">
              <span>Kelebihan (tidak terpakai)</span>
              <b>{formatRupiah(overflow)}</b>
            </div>
          )}
        </div>

        <div>
          <label className="text-xs font-bold block mb-1">Catatan (opsional)</label>
          <input
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            placeholder="mis: tunai pas, transfer BCA"
            className="w-full px-3 py-2 border border-line rounded-md text-sm"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-line">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-line rounded-md text-sm"
            disabled={pending}
          >
            Batal
          </button>
          <button
            onClick={() => (isFull ? onBayarFull() : onBayarPartial(jumlahNum, catatan))}
            disabled={pending || jumlahNum <= 0}
            className="px-4 py-2 bg-emerald-600 text-white rounded-md text-sm font-bold inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            {pending && <Loader2 size={14} className="animate-spin" />}
            Konfirmasi Bayar {formatRupiah(Math.min(jumlahNum, kurir.pendingTotal))}
          </button>
        </div>
      </div>
    </div>
  );
}
