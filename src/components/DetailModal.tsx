"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  X,
  Loader2,
  ExternalLink,
  FileText,
  User,
  Coins,
  Wallet,
  Droplet,
} from "lucide-react";
import {
  getOrderDetail,
  getTransaksiDetail,
  getPelangganDetail,
  getShiftDetail,
  type OrderDetail,
  type TransaksiDetail,
  type PelangganDetail,
  type ShiftDetail,
} from "@/lib/detail-actions";
import { formatRupiah } from "@/lib/utils";
import { normalizeDriveUrl, isPdfUrl } from "@/lib/drive-url";
import { useFormatTanggal } from "./TimezoneContext";

type Props =
  | { kind: "order"; id: number; onClose: () => void }
  | { kind: "transaksi"; id: number; onClose: () => void }
  | { kind: "pelanggan"; id: number; onClose: () => void }
  | { kind: "shift"; id: number; onClose: () => void };

export function DetailModal(props: Props) {
  const [data, setData] = useState<
    OrderDetail | TransaksiDetail | PelangganDetail | ShiftDetail | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  // Nested modal: kalau user klik nama pelanggan di OrderView/TransaksiView
  const [nestedPelangganId, setNestedPelangganId] = useState<number | null>(null);
  // Nested transaksi: kalau user klik baris transaksi di ShiftView
  const [nestedTransaksiId, setNestedTransaksiId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setErr(null);
      try {
        const d =
          props.kind === "order"
            ? await getOrderDetail(props.id)
            : props.kind === "transaksi"
              ? await getTransaksiDetail(props.id)
              : props.kind === "pelanggan"
                ? await getPelangganDetail(props.id)
                : await getShiftDetail(props.id);
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

  const title =
    props.kind === "order"
      ? "Detail Order"
      : props.kind === "transaksi"
        ? "Detail Transaksi"
        : props.kind === "pelanggan"
          ? "Detail Pelanggan"
          : "Detail Shift";

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4"
        onClick={props.onClose}
      >
        <div
          className="bg-surface rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-line">
            <h2 className="font-bold">{title}</h2>
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
            {data && data.kind === "order" && (
              <OrderView data={data} onOpenPelanggan={setNestedPelangganId} />
            )}
            {data && data.kind === "transaksi" && (
              <TransaksiView data={data} onOpenPelanggan={setNestedPelangganId} />
            )}
            {data && data.kind === "pelanggan" && <PelangganView data={data} />}
            {data && data.kind === "shift" && (
              <ShiftView data={data} onOpenTransaksi={setNestedTransaksiId} />
            )}
          </div>
        </div>
      </div>

      {nestedPelangganId !== null && (
        <div className="relative z-[60]">
          <DetailModal
            kind="pelanggan"
            id={nestedPelangganId}
            onClose={() => setNestedPelangganId(null)}
          />
        </div>
      )}

      {nestedTransaksiId !== null && (
        <div className="relative z-[60]">
          <DetailModal
            kind="transaksi"
            id={nestedTransaksiId}
            onClose={() => setNestedTransaksiId(null)}
          />
        </div>
      )}
    </>
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

function OrderView({
  data,
  onOpenPelanggan,
}: {
  data: OrderDetail;
  onOpenPelanggan: (id: number) => void;
}) {
  const fmt = useFormatTanggal();
  return (
    <div className="space-y-4">
      <div>
        <div className="font-mono text-xs text-[color:var(--muted)]">{data.nomorOrder}</div>
        {data.pelangganId !== null ? (
          <button
            onClick={() => onOpenPelanggan(data.pelangganId!)}
            className="font-bold text-lg text-left hover:text-brand hover:underline inline-flex items-center gap-1"
          >
            {data.pelangganNama ?? "Tanpa Akun"}
            <ExternalLink size={14} className="opacity-50" />
          </button>
        ) : (
          <div className="font-bold text-lg">{data.pelangganNama ?? "Tanpa Akun"}</div>
        )}
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
        {data.kurirNama && <Row label="Kurir / Pembuat" value={data.kurirNama} />}
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
          <Row
            label="Bayar"
            value={
              fmt(data.bayarAt, { dateStyle: "short", timeStyle: "short" }) +
              (data.konfirmasiNama ? ` · oleh ${data.konfirmasiNama}` : "")
            }
          />
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

function TransaksiView({
  data,
  onOpenPelanggan,
}: {
  data: TransaksiDetail;
  onOpenPelanggan: (id: number) => void;
}) {
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
        {data.pelangganId !== null ? (
          <button
            onClick={() => onOpenPelanggan(data.pelangganId!)}
            className="font-bold text-lg text-left hover:text-brand hover:underline inline-flex items-center gap-1"
          >
            {data.pelangganNama ?? "Walk-in"}
            <ExternalLink size={14} className="opacity-50" />
          </button>
        ) : (
          <div className="font-bold text-lg">{data.pelangganNama ?? "Walk-in"}</div>
        )}
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

function PelangganView({ data }: { data: PelangganDetail }) {
  return (
    <div className="space-y-4">
      <div>
        <div className="font-bold text-lg inline-flex items-center gap-1.5">
          <User size={18} /> {data.nama}
        </div>
        <div className="flex flex-wrap gap-1.5 mt-1">
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
              data.tipe === "langganan"
                ? "bg-emerald-100 text-emerald-700"
                : "bg-[color:var(--surface2)] text-[color:var(--muted)]"
            }`}
          >
            {data.tipe.toUpperCase()}
          </span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
              data.hasAccount
                ? "bg-sky-100 text-sky-700"
                : "bg-amber-100 text-amber-700"
            }`}
          >
            {data.hasAccount ? "AKUN ✓" : "WALK-IN"}
          </span>
        </div>
        {data.telp && (
          <div className="text-xs text-[color:var(--muted)] mt-1">📞 {data.telp}</div>
        )}
        {data.alamat && (
          <div className="text-xs text-[color:var(--muted)] mt-0.5">📍 {data.alamat}</div>
        )}
        {data.linkedUserName && (
          <div className="text-[10px] text-sky-700 mt-1">
            Tertaut akun: {data.linkedUserName}
          </div>
        )}
      </div>

      {data.piutangTotal > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="text-[10px] font-bold tracking-widest text-red-700">
            ⚠ PIUTANG BELUM LUNAS
          </div>
          <div className="text-xl font-extrabold text-red-900 mt-0.5">
            {formatRupiah(data.piutangTotal)}
          </div>
          <div className="text-[11px] text-red-700">{data.piutangCount} order</div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <StatBox
          icon={<Coins size={14} className="text-brand" />}
          label="Saldo Loyalty"
          value={formatRupiah(data.saldoLoyalti)}
          accent={data.saldoLoyalti > 0}
        />
        <StatBox
          icon={<Droplet size={14} className="text-amber-500" />}
          label="Stamp Galon"
          value={`${data.stampGalon}/10`}
        />
        <StatBox
          icon={<Wallet size={14} className="text-emerald-600" />}
          label="Total Earn"
          value={formatRupiah(data.totalEarn)}
        />
        <StatBox
          icon={<Wallet size={14} className="text-red-500" />}
          label="Total Redeem"
          value={formatRupiah(data.totalRedeem)}
        />
      </div>

      <div className="bg-[color:var(--surface2)] rounded-lg p-3 space-y-0.5">
        <Row label="Total Transaksi" value={`${data.totalTransaksi} (omzet ${formatRupiah(data.totalOmzet)})`} />
        <Row label="Total Order Antar" value={`${data.totalOrder}`} />
        {data.galonDipinjam > 0 && (
          <Row
            label="🚛 Galon Dipinjam"
            value={<span className="text-amber-700 font-bold">{data.galonDipinjam} galon</span>}
          />
        )}
        {data.galonTitipan > 0 && (
          <Row
            label="💧 Galon Titipan"
            value={<span className="text-sky-700 font-bold">{data.galonTitipan} galon</span>}
          />
        )}
      </div>

      <Link
        href={`/data-pelanggan/${data.id}`}
        className="block w-full text-center py-2 border border-line rounded-md text-xs hover:border-brand hover:text-brand transition inline-flex items-center justify-center gap-1.5"
      >
        Buka halaman pelanggan <ExternalLink size={12} />
      </Link>
    </div>
  );
}

function StatBox({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-[color:var(--surface2)] rounded-lg p-2.5">
      <div className="text-[9px] uppercase tracking-widest text-[color:var(--muted)] inline-flex items-center gap-1">
        {icon} {label}
      </div>
      <div className={`font-extrabold text-sm mt-0.5 ${accent ? "text-brand" : "text-ink"}`}>
        {value}
      </div>
    </div>
  );
}

function ShiftView({
  data,
  onOpenTransaksi,
}: {
  data: ShiftDetail;
  onOpenTransaksi: (id: number) => void;
}) {
  const fmt = useFormatTanggal();
  const selisih = data.selisih ?? 0;
  return (
    <div className="space-y-4">
      <div>
        <div className="font-bold text-lg inline-flex items-center gap-1.5">
          <User size={16} /> {data.kasirNama}
        </div>
        <div className="flex flex-wrap gap-1.5 mt-1">
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
              data.status === "open"
                ? "bg-emerald-100 text-emerald-700"
                : "bg-[color:var(--surface2)] text-[color:var(--muted)]"
            }`}
          >
            {data.status.toUpperCase()}
          </span>
          {data.closedByNama && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">
              Force-close oleh {data.closedByNama}
            </span>
          )}
          {data.reopenedAt && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-bold">
              ↻ REOPENED
            </span>
          )}
        </div>
      </div>

      <div className="bg-[color:var(--surface2)] rounded-lg p-3 space-y-0.5">
        <Row label="Buka" value={fmt(data.openedAt, { dateStyle: "medium", timeStyle: "short" })} />
        {data.closedAt && (
          <Row
            label="Tutup"
            value={fmt(data.closedAt, { dateStyle: "medium", timeStyle: "short" })}
          />
        )}
      </div>

      {data.status === "closed" && (
        <div className="bg-[color:var(--surface2)] rounded-lg p-3 space-y-0.5 text-xs">
          <Row
            label="Uang awal"
            value={data.openingCash !== null ? formatRupiah(data.openingCash) : "—"}
          />
          <Row
            label="+ Omzet cash"
            value={formatRupiah(data.ringkasan.omzetCash)}
          />
          {data.ringkasan.totalKasMasukLain > 0 && (
            <Row
              label={`+ Kas masuk lain (${data.ringkasan.jumlahKasMasukLain}x)`}
              value={formatRupiah(data.ringkasan.totalKasMasukLain)}
            />
          )}
          {data.ringkasan.totalPengeluaran > 0 && (
            <Row
              label="− Pengeluaran"
              value={formatRupiah(data.ringkasan.totalPengeluaran)}
            />
          )}
          <div className="border-t border-line my-1" />
          <Row label="= Ekspektasi" value={<b>{formatRupiah(data.ringkasan.expected)}</b>} />
          {data.closingCashCounted !== null && (
            <Row label="Uang fisik" value={<b>{formatRupiah(data.closingCashCounted)}</b>} />
          )}
          <Row
            label="Selisih"
            value={
              <b
                className={
                  selisih === 0
                    ? "text-[color:var(--muted)]"
                    : selisih > 0
                      ? "text-emerald-700"
                      : "text-red-600"
                }
              >
                {selisih > 0 ? "+" : ""}
                {formatRupiah(selisih)}
              </b>
            }
          />
        </div>
      )}

      {(data.ringkasan.omzetTransfer > 0 || data.ringkasan.omzetQris > 0) && (
        <div className="bg-sky-50 border border-sky-200 rounded-lg p-3 space-y-0.5 text-xs">
          <div className="text-[10px] font-bold text-sky-800 uppercase tracking-wide mb-1">
            Non-cash (ke rekening)
          </div>
          {data.ringkasan.omzetTransfer > 0 && (
            <Row label="Transfer" value={formatRupiah(data.ringkasan.omzetTransfer)} />
          )}
          {data.ringkasan.omzetQris > 0 && (
            <Row label="QRIS" value={formatRupiah(data.ringkasan.omzetQris)} />
          )}
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-bold uppercase tracking-wide text-[color:var(--muted)]">
            Transaksi ({data.transaksiList.length})
          </h3>
        </div>
        {data.transaksiList.length === 0 ? (
          <div className="text-xs text-[color:var(--muted)] py-3 text-center">
            Belum ada transaksi di shift ini
          </div>
        ) : (
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {data.transaksiList.map((t) => {
              const isPiutangLunas = t.refOrderId !== null;
              return (
                <button
                  key={t.id}
                  onClick={() => onOpenTransaksi(t.id)}
                  className={`w-full text-left rounded-md p-2 hover:bg-brand-soft transition block ${
                    isPiutangLunas
                      ? "bg-amber-50 border border-amber-200"
                      : "bg-[color:var(--surface2)]"
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] font-mono text-[color:var(--muted)] inline-flex items-center gap-1.5">
                        {t.nomorNota}
                        {isPiutangLunas && (
                          <span className="px-1 py-0.5 rounded bg-amber-200 text-amber-900 text-[9px] font-bold">
                            PIUTANG LUNAS
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-semibold truncate">
                        {t.pelangganNama ?? "Walk-in"}
                      </div>
                      <div className="text-[10px] text-[color:var(--muted)]">
                        {fmt(t.createdAt, { timeStyle: "short" })} ·{" "}
                        {t.metodeBayar.toUpperCase()}
                        {isPiutangLunas && t.refOrderNomor && (
                          <span className="ml-1 text-amber-700">
                            · dari {t.refOrderNomor}
                          </span>
                        )}
                      </div>
                    </div>
                    <div
                      className={`text-sm font-bold whitespace-nowrap ${
                        t.voided ? "line-through text-[color:var(--muted)]" : "text-brand"
                      }`}
                    >
                      {formatRupiah(t.total)}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {data.pengeluaranList.length > 0 && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wide text-[color:var(--muted)] mb-2">
            Pengeluaran ({data.pengeluaranList.length})
          </h3>
          <div className="space-y-1">
            {data.pengeluaranList.map((p) => (
              <div
                key={p.id}
                className="bg-red-50 border border-red-200 rounded-md p-2 text-xs flex justify-between items-start gap-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-red-900">{p.kategori}</div>
                  {p.deskripsi && (
                    <div className="text-[10px] text-red-700 mt-0.5">{p.deskripsi}</div>
                  )}
                </div>
                <div className="font-bold text-red-700 whitespace-nowrap">
                  {formatRupiah(p.jumlah)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.kasMasukList.length > 0 && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wide text-[color:var(--muted)] mb-2">
            Kas Masuk Lain ({data.kasMasukList.length})
          </h3>
          <div className="space-y-1">
            {data.kasMasukList.map((k) => (
              <div
                key={k.id}
                className="bg-emerald-50 border border-emerald-200 rounded-md p-2 text-xs flex justify-between items-start gap-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-emerald-900">{k.kategori}</div>
                  {k.deskripsi && (
                    <div className="text-[10px] text-emerald-700 mt-0.5">
                      {k.deskripsi}
                    </div>
                  )}
                </div>
                <div className="font-bold text-emerald-700 whitespace-nowrap">
                  {formatRupiah(k.jumlah)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.catatan && (
        <div className="text-xs italic text-[color:var(--muted)] border-t border-line pt-2 whitespace-pre-line">
          {data.catatan}
        </div>
      )}
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
