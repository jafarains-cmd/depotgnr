import Link from "next/link";
import { eq, desc, inArray } from "drizzle-orm";
import { CreditCard, RefreshCw, FileText } from "lucide-react";
import { db } from "@/db";
import { orderHeader, orderItem } from "@/db/schema/order";
import { transaksi } from "@/db/schema/transaksi";
import { produk } from "@/db/schema/produk";
import { requireSession } from "@/lib/permissions";
import { getOrCreatePelanggan } from "@/lib/pelanggan";
import { formatRupiah } from "@/lib/utils";
import { GallonArt } from "@/components/GallonArt";
import { CancelOrderButton } from "../order-baru/CancelOrderButton";
import { RiwayatFilter } from "./RiwayatFilter";

export const dynamic = "force-dynamic";

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  diproses: "bg-blue-100 text-blue-700",
  dijemput: "bg-indigo-100 text-indigo-700",
  diisi: "bg-cyan-100 text-cyan-700",
  diantar: "bg-violet-100 text-violet-700",
  selesai: "bg-emerald-100 text-emerald-700",
  batal: "bg-[color:var(--surface2)] text-[color:var(--muted)]",
};

export default async function RiwayatPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter = "semua" } = await searchParams;
  const session = await requireSession();
  const me = await getOrCreatePelanggan(session.user.id, session.user.name);

  const orders = await db
    .select()
    .from(orderHeader)
    .where(eq(orderHeader.pelangganId, me.id))
    .orderBy(desc(orderHeader.createdAt))
    .limit(50);

  const orderIds = orders.map((o) => o.id);
  const allItems = orderIds.length
    ? await db
        .select({
          orderId: orderItem.orderId,
          qty: orderItem.qty,
          jenis: orderItem.jenis,
          namaProduk: produk.nama,
        })
        .from(orderItem)
        .leftJoin(produk, eq(orderItem.produkId, produk.id))
        .where(inArray(orderItem.orderId, orderIds))
    : [];

  const itemsByOrder = new Map<number, typeof allItems>();
  for (const it of allItems) {
    const arr = itemsByOrder.get(it.orderId) ?? [];
    arr.push(it);
    itemsByOrder.set(it.orderId, arr);
  }

  const trxList = await db
    .select()
    .from(transaksi)
    .where(eq(transaksi.pelangganId, me.id))
    .orderBy(desc(transaksi.createdAt))
    .limit(20);

  const filtered = orders.filter((o) => {
    if (filter === "aktif") return !["selesai", "batal"].includes(o.status);
    if (filter === "selesai") return o.status === "selesai";
    if (filter === "batal") return o.status === "batal";
    return true;
  });

  return (
    <div>
      <div className="bg-surface border-b border-line -mx-4 sm:mx-0 sm:rounded-t-2xl px-4 sm:px-5 pt-3 pb-3">
        <h1 className="text-2xl font-extrabold tracking-tight">Riwayat Pesanan</h1>
        <RiwayatFilter active={filter} />
      </div>

      <div className="space-y-2 mt-3">
        {filtered.length === 0 && (
          <div className="bg-surface border border-line rounded-2xl p-8 text-center text-[color:var(--muted)] text-sm">
            Belum ada pesanan.
          </div>
        )}
        {filtered.map((o) => {
          const its = itemsByOrder.get(o.id) ?? [];
          const summary = its
            .map((i) => `${i.qty} ${i.namaProduk ?? "?"}`)
            .join(" + ");
          return (
            <div key={o.id} className="bg-surface border border-line rounded-2xl p-4">
              <div className="flex justify-between items-center mb-2.5">
                <div className="text-[11px] text-[color:var(--muted)] font-semibold">
                  {o.nomorOrder} ·{" "}
                  {o.createdAt.toLocaleString("id-ID", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wide ${
                    STATUS_COLOR[o.status] ?? "bg-[color:var(--surface2)] text-ink"
                  }`}
                >
                  {o.status}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-11 h-14 bg-[color:var(--surface2)] rounded-xl grid place-items-center flex-shrink-0">
                  <GallonArt size={36} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold line-clamp-1">{summary || "—"}</div>
                  <div className="text-base font-extrabold text-brand mt-1">
                    {formatRupiah(o.totalEstimasi)}
                  </div>
                </div>
                <Link
                  href="/pelanggan/order-baru"
                  className="px-3 py-2 border-2 border-line rounded-full text-[11px] font-bold inline-flex items-center gap-1 hover:border-brand hover:text-brand transition"
                >
                  <RefreshCw size={11} /> Pesan ulang
                </Link>
              </div>

              {o.status !== "batal" && (
                <div className="mt-2.5 pt-2.5 border-t border-line flex items-center justify-between gap-2">
                  <PayBadge status={o.statusBayar} metode={o.metodeBayar} />
                  <div className="flex gap-2">
                    {o.status === "pending" && (
                      <CancelOrderButton orderId={o.id} nomorOrder={o.nomorOrder} />
                    )}
                    <Link
                      href={`/pelanggan/order/${o.id}/nota`}
                      className="text-[11px] px-3 py-1.5 border-2 border-line rounded-full font-bold inline-flex items-center gap-1 hover:border-brand hover:text-brand transition"
                    >
                      <FileText size={11} /> Nota
                    </Link>
                    {(o.statusBayar === "belum" || o.statusBayar === "menunggu") && (
                      <Link
                        href={`/pelanggan/order/${o.id}/bayar`}
                        className="text-[11px] px-3 py-1.5 bg-brand text-white rounded-full font-bold inline-flex items-center gap-1"
                      >
                        <CreditCard size={11} />
                        {o.statusBayar === "menunggu" ? "Status Bayar" : "Bayar"}
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {trxList.length > 0 && (
        <section className="mt-6">
          <h2 className="text-lg font-extrabold mb-3">Riwayat Transaksi</h2>
          <div className="space-y-2">
            {trxList.map((t) => (
              <div
                key={t.id}
                className="bg-surface border border-line rounded-2xl p-3 flex justify-between items-center"
              >
                <div>
                  <div className="text-[11px] font-mono text-[color:var(--muted)]">
                    {t.nomorNota}
                  </div>
                  <div className="text-[11px] text-[color:var(--muted)]">
                    {t.createdAt.toLocaleString("id-ID", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    · {t.metodeBayar.toUpperCase()}
                  </div>
                </div>
                <div className="font-extrabold text-brand">{formatRupiah(t.total)}</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function PayBadge({ status, metode }: { status: string; metode: string | null }) {
  if (status === "lunas") {
    return (
      <span className="text-[10px] px-2 py-1 bg-emerald-100 text-emerald-800 rounded-full font-bold">
        ✓ Lunas{metode ? ` · ${metode.toUpperCase()}` : ""}
      </span>
    );
  }
  if (status === "menunggu") {
    return (
      <span className="text-[10px] px-2 py-1 bg-amber-100 text-amber-800 rounded-full font-bold">
        Menunggu verifikasi
      </span>
    );
  }
  if (metode === "cod") {
    return (
      <span className="text-[10px] px-2 py-1 bg-blue-100 text-blue-800 rounded-full font-bold">
        Bayar saat antar
      </span>
    );
  }
  return (
    <span className="text-[10px] px-2 py-1 bg-[color:var(--surface2)] text-[color:var(--muted)] rounded-full font-bold">
      Belum bayar
    </span>
  );
}
