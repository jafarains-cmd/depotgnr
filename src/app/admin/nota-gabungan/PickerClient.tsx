"use client";

import { useMemo, useState } from "react";
import { FileText } from "lucide-react";
import { formatRupiah } from "@/lib/utils";

type OrderRow = {
  id: number;
  nomorOrder: string;
  createdAt: string;
  status: string;
  statusBayar: string;
  totalEstimasi: number;
  totalGalon: number;
  notaGabunganKode: string | null;
};

export function PickerClient({ orders }: { orders: OrderRow[] }) {
  const [picked, setPicked] = useState<Set<number>>(new Set());

  const summary = useMemo(() => {
    let totalGalon = 0;
    let total = 0;
    let belumLunas = 0;
    for (const o of orders) {
      if (picked.has(o.id)) {
        totalGalon += o.totalGalon;
        total += o.totalEstimasi;
        if (o.statusBayar !== "lunas") belumLunas++;
      }
    }
    return { totalGalon, total, belumLunas };
  }, [picked, orders]);

  function toggle(id: number) {
    setPicked((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function isEligible(o: OrderRow) {
    return o.statusBayar !== "lunas" && !o.notaGabunganKode;
  }
  function pickAll() {
    setPicked(new Set(orders.filter(isEligible).map((o) => o.id)));
  }
  function pickPiutang() {
    setPicked(new Set(orders.filter(isEligible).map((o) => o.id)));
  }
  function clearPick() {
    setPicked(new Set());
  }

  const cetakHref =
    picked.size > 0
      ? `/admin/nota-gabungan/cetak?ids=${[...picked].join(",")}`
      : "#";

  return (
    <div className="space-y-3">
      <div className="bg-surface border border-line rounded-2xl p-3">
        <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
          <div className="text-[color:var(--muted)]">
            {orders.length} order selesai · {picked.size} dipilih
          </div>
          <div className="flex gap-1">
            <button
              onClick={pickPiutang}
              className="px-2 py-1 rounded-md bg-amber-100 text-amber-800 font-bold"
            >
              Pilih yang Piutang
            </button>
            <button
              onClick={pickAll}
              className="px-2 py-1 rounded-md bg-[color:var(--surface2)] font-bold"
            >
              Pilih Semua
            </button>
            <button
              onClick={clearPick}
              className="px-2 py-1 rounded-md text-[color:var(--muted)]"
            >
              Bersihkan
            </button>
          </div>
        </div>
      </div>

      <div className="bg-surface border border-line rounded-2xl overflow-hidden">
        {orders.length === 0 ? (
          <div className="p-8 text-center text-sm text-[color:var(--muted)]">
            Pelanggan ini belum punya order berstatus selesai.
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {orders.map((o) => {
              const lunas = o.statusBayar === "lunas";
              const sudahDiGrup = !!o.notaGabunganKode;
              const disabled = lunas || sudahDiGrup;
              return (
                <li key={o.id}>
                  <label
                    className={`flex items-center gap-3 p-3 ${
                      disabled
                        ? "opacity-60 cursor-not-allowed bg-[color:var(--surface2)]/50"
                        : "hover:bg-[color:var(--surface2)] cursor-pointer"
                    }`}
                    title={
                      sudahDiGrup
                        ? `Sudah di grup ${o.notaGabunganKode}. Lepas dari grup dulu untuk pilih ulang.`
                        : lunas
                          ? "Sudah lunas — tidak bisa digabung"
                          : ""
                    }
                  >
                    <input
                      type="checkbox"
                      checked={picked.has(o.id)}
                      onChange={() => !disabled && toggle(o.id)}
                      disabled={disabled}
                      className="w-4 h-4"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-sm font-bold text-brand">
                        {o.nomorOrder}
                      </div>
                      <div className="text-xs text-[color:var(--muted)]">
                        {new Date(o.createdAt).toLocaleString("id-ID", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        · {o.totalGalon} galon
                      </div>
                      {sudahDiGrup && (
                        <div className="text-[10px] text-amber-700 mt-0.5 font-bold">
                          📎 Di grup {o.notaGabunganKode}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-sm">{formatRupiah(o.totalEstimasi)}</div>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                          lunas
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {lunas ? "LUNAS" : "PIUTANG"}
                      </span>
                    </div>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {picked.size > 0 && (
        <div className="bg-brand-50 border border-brand-200 rounded-2xl p-4 space-y-2">
          <div className="text-xs font-bold tracking-widest text-brand-700">
            RINGKASAN GABUNGAN
          </div>
          <div className="flex justify-between text-sm">
            <span>{picked.size} order · {summary.totalGalon} galon</span>
            <span className="font-extrabold">{formatRupiah(summary.total)}</span>
          </div>
          {summary.belumLunas > 0 && (
            <div className="text-xs text-amber-700">
              ⚠ {summary.belumLunas} order belum lunas — bisa ditandai lunas di halaman cetak.
            </div>
          )}
          <a
            href={cetakHref}
            className="w-full py-2.5 bg-brand-600 text-white rounded-md text-sm font-extrabold inline-flex items-center justify-center gap-1.5"
          >
            <FileText size={14} /> Buat Nota Gabungan
          </a>
        </div>
      )}

      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-xs text-amber-900">
        ℹ Nota gabungan hanya menggabungkan tampilan untuk cetak/arsip. Tiap order
        tetap punya record sendiri di database (audit trail, bonus kurir, loyalty
        tetap utuh).
      </div>
    </div>
  );
}
