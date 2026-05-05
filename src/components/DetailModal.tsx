"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X, Loader2, ExternalLink, FileText } from "lucide-react";
import {
  getOrderDetail,
  getTransaksiDetail,
  type OrderDetail,
  type TransaksiDetail,
} from "@/lib/detail-actions";
import { formatRupiah } from "@/lib/utils";
import { normalizeDriveUrl, isPdfUrl } from "@/lib/drive-url";
import { useFormatTanggal } from "./TimezoneContext";

type Props =
  | { kind: "order"; id: number; onClose: () => void }
  | { kind: "transaksi"; id: number; onClose: () => void };

export function DetailModal(props: Props) {
  const [data, setData] = useState<OrderDetail | TransaksiDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setErr(null);
      try {
        const d =
          props.kind === "order"
            ? await getOrderDetail(props.id)
            : await getTransaksiDetail(props.id);
        if (!cancelled) {
          if (!d) setErr("Data tidak ditemukan");
          else setData(d);
        }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Gagal muat detail");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [props.kind, props.id]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={props.onClose}
    >
      <div
        className="bg-surface rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-line">
          <h2 className="font-bold">Detail {props.kind === "order" ? "Order" : "Transaksi"}</h2>
          <button
            onClick={props.onClose}
            className="w-8 h-8 grid place-items-center rounded-lg hover:bg-[color:var(--surface2)]"
            aria-label="Tutup"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {loading && (
            <div className="py-12 text-center text-[color:var(--muted)]">
              <Loader2 className="inline animate-spin" size={20} />
              <div className="text-xs mt-2">Memuat detail...</div>
            </div>
          )}
          {err && <div className="py-8 text-center text-red-600 text-sm">{err}</div>}
          {data && data.kind === "order" && <OrderView data={data} />}
          {data && data.kind === "transaksi" && <TransaksiView data={data} />}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2 text-xs py-1">
      <span className="text-[color:var(--muted)]">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}

function ItemList({ items }: { items: OrderDetail["items"] }) {
  return (
    <div className="space-y-1.5">
      {items.map((it, i) => (
        <div key={i} className="flex justify-between gap-2 text-xs">
          <div>
            <div className="font-medium">{it.namaProduk}</div>
            <div className="text-[color:var(--muted)]">
              {it.qty} × {formatRupiah(it.hargaSatuan)} ({it.jenis})
            </div>
          </div>
          <div className="font-mono whitespace-nowrap">{formatRupiah(it.subtotal)}</div>
        </div>
      ))}
    </div>
  );
}

function OrderView({ data }: { data: OrderDetail }) {
  const fmt = useFormatTanggal();
  return (
    <div className="space-y-4">
      <div>
        <div className="font-mono text-xs text-[color:var(--muted)]">{data.nomorOrder}</div>
        <div className="font-bold text-lg">{data.pelangganNama ?? "Tanpa Akun"}</div>
        {data.pelangganTelp && (
          <div className="text-xs text-[color:var(--muted)]">📞 {data.pelangganTelp}</div>
        )}
      </div>

      <div className="bg-[color:var(--surface2)] rounded-lg p-3 space-y-0.5">
        <Row label="Status Order" value={data.status.toUpperCase()} />
        <Row label="Status Bayar" value={data.statusBayar.toUpperCase()} />
        {data.metodeBayar && <Row label="Metode" value={data.metodeBayar.toUpperCase()} />}
        <Row label="Sumber" value={data.sumber} />
        <Row label="Tipe" value={data.tipePengantaran} />
        {data.kurirNama && <Row label="Kurir" value={data.kurirNama} />}
      </div>

      <div className="bg-[color:var(--surface2)] rounded-lg p-3 space-y-0.5">
        <Row label="Order" value={fmt(data.createdAt, { dateStyle: "medium", timeStyle: "short" })} />
        {data.diantarAt && (
          <Row label="Diantar" value={fmt(data.diantarAt, { dateStyle: "short", timeStyle: "short" })} />
        )}
        {data.selesaiAt && (
          <Row label="Selesai" value={fmt(data.selesaiAt, { dateStyle: "short", timeStyle: "short" })} />
        )}
        {data.bayarAt && (
          <Row label="Bayar" value={fmt(data.bayarAt, { dateStyle: "short", timeStyle: "short" })} />
        )}
      </div>

      {data.alamatAntar && (
        <div className="text-xs">
          <div className="text-[color:var(--muted)] mb-0.5">📍 Alamat Antar</div>
          <div>{data.alamatAntar}</div>
        </div>
      )}

      <div>
        <div className="text-xs text-[color:var(--muted)] mb-2 font-semibold uppercase tracking-wide">
          Items
        </div>
        <ItemList items={data.items} />
      </div>

      <div className="border-t border-line pt-2 space-y-0.5">
        {data.loyaltiDipakai > 0 && (
          <Row label="Loyalty" value={`- ${formatRupiah(data.loyaltiDipakai)}`} />
        )}
        <div className="flex justify-between text-base font-extrabold pt-1">
          <span>TOTAL</span>
          <span className="text-brand">
            {formatRupiah(data.totalEstimasi - data.loyaltiDipakai)}
          </span>
        </div>
      </div>

      {data.catatan && (
        <div className="text-xs italic text-[color:var(--muted)] border-t border-line pt-2">
          "{data.catatan}"
        </div>
      )}

      {(data.buktiFotoUrl || data.buktiBayarUrl) && (
        <div className="space-y-2 border-t border-line pt-3">
          {data.buktiFotoUrl && (
            <BuktiPreview label="Bukti Antar" url={data.buktiFotoUrl} />
          )}
          {data.buktiBayarUrl && (
            <BuktiPreview label="Bukti Bayar" url={data.buktiBayarUrl} />
          )}
        </div>
      )}
    </div>
  );
}

function TransaksiView({ data }: { data: TransaksiDetail }) {
  const fmt = useFormatTanggal();
  const isVoided = !!data.voidedAt;
  return (
    <div className="space-y-4">
      {isVoided && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
          <div className="text-red-700 font-extrabold">TRANSAKSI DIBATALKAN</div>
          <div className="text-[10px] text-red-600 mt-1">
            {fmt(data.voidedAt!, { dateStyle: "short", timeStyle: "short" })}
            {data.voidedAlasan && ` · ${data.voidedAlasan}`}
          </div>
        </div>
      )}
      <div>
        <div className="font-mono text-xs text-[color:var(--muted)]">{data.nomorNota}</div>
        <div className="font-bold text-lg">{data.pelangganNama ?? "Walk-in"}</div>
        {data.pelangganTelp && (
          <div className="text-xs text-[color:var(--muted)]">📞 {data.pelangganTelp}</div>
        )}
      </div>

      <div className="bg-[color:var(--surface2)] rounded-lg p-3 space-y-0.5">
        <Row label="Tanggal" value={fmt(data.createdAt, { dateStyle: "medium", timeStyle: "short" })} />
        {data.kasirNama && <Row label="Kasir" value={data.kasirNama} />}
        <Row label="Metode" value={data.metodeBayar.toUpperCase()} />
        <Row label="Status" value={data.status.toUpperCase()} />
      </div>

      <div>
        <div className="text-xs text-[color:var(--muted)] mb-2 font-semibold uppercase tracking-wide">
          Items
        </div>
        <ItemList items={data.items} />
      </div>

      <div className="border-t border-line pt-2 space-y-0.5">
        <Row label="Subtotal" value={formatRupiah(data.subtotal)} />
        {data.diskon > 0 && <Row label="Diskon" value={`- ${formatRupiah(data.diskon)}`} />}
        <div
          className={`flex justify-between text-base font-extrabold pt-1 ${
            isVoided ? "line-through text-[color:var(--muted)]" : ""
          }`}
        >
          <span>TOTAL</span>
          <span className="text-brand">{formatRupiah(data.total)}</span>
        </div>
      </div>

      {data.catatan && (
        <div className="text-xs italic text-[color:var(--muted)] border-t border-line pt-2">
          "{data.catatan}"
        </div>
      )}

      <Link
        href={`/kasir/transaksi/${data.id}`}
        className="block w-full text-center py-2 border border-line rounded-md text-xs hover:border-brand hover:text-brand transition"
      >
        Buka halaman nota →
      </Link>
    </div>
  );
}

function BuktiPreview({ label, url }: { label: string; url: string }) {
  const isPdf = isPdfUrl(url);
  return (
    <div>
      <div className="text-[10px] text-[color:var(--muted)] uppercase tracking-wide font-semibold mb-1">
        {label}
      </div>
      {isPdf ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-brand font-bold border border-line rounded-md px-3 py-2 hover:border-brand"
        >
          <FileText size={14} /> Buka PDF
        </a>
      ) : (
        <a href={url} target="_blank" rel="noreferrer" className="block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={normalizeDriveUrl(url)}
            alt={label}
            className="w-full max-h-48 object-contain rounded-md border border-line bg-[color:var(--surface2)]"
          />
          <span className="text-[10px] text-brand inline-flex items-center gap-1 mt-1">
            <ExternalLink size={10} /> Buka di tab baru
          </span>
        </a>
      )}
    </div>
  );
}
