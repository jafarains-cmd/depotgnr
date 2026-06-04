import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { ArrowLeft, MapPin, Phone, Clock, MessageSquare } from "lucide-react";
import { db } from "@/db";
import { normalizeDriveUrl } from "@/lib/drive-url";
import { orderHeader, orderItem } from "@/db/schema/order";
import { pelanggan as pelangganTable } from "@/db/schema/pelanggan";
import { produk as produkTable } from "@/db/schema/produk";
import { requireRole } from "@/lib/permissions";
import { KonfirmasiClient } from "./KonfirmasiClient";
import { TrackingButton } from "./TrackingButton";

export const dynamic = "force-dynamic";

export default async function KurirOrderDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isFinite(orderId)) notFound();

  const session = await requireRole(["admin", "kasir", "kurir"]);
  const role = session.user.role;

  const o = await db.query.orderHeader.findFirst({ where: eq(orderHeader.id, orderId) });
  if (!o) notFound();
  if (role !== "admin" && role !== "kasir" && o.kurirUserId !== session.user.id) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
        Order ini bukan tugas Anda.
      </div>
    );
  }

  const pel = o.pelangganId
    ? await db.query.pelanggan.findFirst({ where: eq(pelangganTable.id, o.pelangganId) })
    : null;

  const items = await db
    .select({
      qty: orderItem.qty,
      jenis: orderItem.jenis,
      hargaEstimasi: orderItem.hargaEstimasi,
      produkNama: produkTable.nama,
    })
    .from(orderItem)
    .leftJoin(produkTable, eq(orderItem.produkId, produkTable.id))
    .where(eq(orderItem.orderId, orderId));

  const mapsUrl = pel?.koordinatLat && pel?.koordinatLng
    ? `https://www.google.com/maps/search/?api=1&query=${pel.koordinatLat},${pel.koordinatLng}`
    : o.alamatAntar
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(o.alamatAntar)}`
      : null;

  const waUrl = pel?.telp ? `https://wa.me/${normalizeWa(pel.telp)}` : null;

  return (
    <div className="space-y-3">
      <Link
        href="/kurir"
        className="inline-flex items-center gap-1 text-sm text-[color:var(--muted)] hover:text-ink"
      >
        <ArrowLeft size={16} /> Kembali
      </Link>

      <div className="bg-surface border border-line rounded-2xl p-4 space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="font-bold">{o.nomorOrder}</div>
          <div className="flex items-center gap-1.5">
            {o.tipePengantaran === "jemput-antar" && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-100 text-violet-700">
                🔄 jemput-isi-antar
              </span>
            )}
            <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-800 rounded">{o.status}</span>
          </div>
        </div>
        <div className="text-lg font-semibold">{pel?.nama ?? "Pelanggan"}</div>
        {o.jadwalAntar && (
          <div className="text-sm text-[color:var(--muted)] inline-flex items-center gap-1">
            <Clock size={14} />
            {new Date(o.jadwalAntar).toLocaleString("id-ID", {
              dateStyle: "full",
              timeStyle: "short",
            })}
          </div>
        )}
      </div>

      <div className="bg-surface border border-line rounded-2xl p-4 space-y-3">
        <div className="text-sm font-semibold">Alamat & Kontak</div>
        {o.alamatAntar && (
          <div className="text-sm">
            <div className="inline-flex items-start gap-1 text-ink">
              <MapPin size={14} className="mt-0.5 flex-shrink-0" />
              <span>{o.alamatAntar}</span>
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          {mapsUrl && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-2 bg-[color:var(--surface2)] hover:bg-[color:var(--surface2)] rounded-lg text-sm inline-flex items-center justify-center gap-1.5"
            >
              <MapPin size={14} /> Buka Maps
            </a>
          )}
          {waUrl && (
            <a
              href={waUrl}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-lg text-sm inline-flex items-center justify-center gap-1.5"
            >
              <Phone size={14} /> Chat WA
            </a>
          )}
        </div>
        {pel?.telp && (
          <div className="text-xs text-[color:var(--muted)]">No. WA: {pel.telp}</div>
        )}
      </div>

      {o.catatan && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-900">
          <div className="font-semibold inline-flex items-center gap-1 text-xs mb-1">
            <MessageSquare size={12} /> Catatan
          </div>
          {o.catatan}
        </div>
      )}

      <div className="bg-surface border border-line rounded-2xl p-4">
        <div className="text-sm font-semibold mb-2">Item Order</div>
        <div className="divide-y divide-line">
          {items.map((it, i) => (
            <div key={i} className="py-2 flex justify-between text-sm">
              <div>
                <div className="font-medium">{it.produkNama}</div>
                <div className="text-xs text-[color:var(--muted)]">
                  {it.jenis.replace("_", " ")} × {it.qty}
                </div>
              </div>
              <div className="text-right text-ink">
                Rp {(it.hargaEstimasi * it.qty).toLocaleString("id-ID")}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 pt-3 border-t border-line flex justify-between font-semibold text-sm">
          <span>Total Estimasi</span>
          <span>Rp {o.totalEstimasi.toLocaleString("id-ID")}</span>
        </div>
      </div>

      <TrackingButton orderId={o.id} status={o.status} />

      <KonfirmasiClient
        orderId={o.id}
        status={o.status}
        tipe={o.tipePengantaran}
        qtyOrder={items.reduce((s, it) => s + it.qty, 0)}
        pelangganId={o.pelangganId}
      />

      {o.buktiJemputUrl && (
        <div className="bg-surface border border-line rounded-2xl p-4">
          <div className="text-sm font-semibold mb-2">Bukti Jemput Galon</div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={normalizeDriveUrl(o.buktiJemputUrl)}
            alt="Bukti jemput"
            className="w-full rounded-lg border border-line"
          />
          {o.dijemputAt && (
            <div className="text-xs text-[color:var(--muted)] mt-2">
              Dijemput:{" "}
              {new Date(o.dijemputAt).toLocaleString("id-ID", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </div>
          )}
        </div>
      )}

      {o.status === "selesai" && o.buktiFotoUrl && (
        <div className="bg-surface border border-line rounded-2xl p-4">
          <div className="text-sm font-semibold mb-2">Bukti Pengantaran</div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={normalizeDriveUrl(o.buktiFotoUrl)}
            alt="Bukti"
            className="w-full rounded-lg border border-line"
          />
          {o.diantarAt && (
            <div className="text-xs text-[color:var(--muted)] mt-2">
              Diantar:{" "}
              {new Date(o.diantarAt).toLocaleString("id-ID", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function normalizeWa(p: string): string {
  let s = p.replace(/\D/g, "");
  if (s.startsWith("0")) s = "62" + s.slice(1);
  if (s.startsWith("8")) s = "62" + s;
  return s;
}
