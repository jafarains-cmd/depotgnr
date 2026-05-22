import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { ArrowLeft, CheckCircle2, Clock } from "lucide-react";
import { db } from "@/db";
import { orderHeader, orderItem } from "@/db/schema/order";
import { pelanggan as pelangganTable } from "@/db/schema/pelanggan";
import { pengaturan } from "@/db/schema/pengaturan";
// Loyalty info loaded from pelanggan record
import { requireSession } from "@/lib/permissions";
import { formatRupiah } from "@/lib/utils";
import { BayarClient } from "./BayarClient";

export const dynamic = "force-dynamic";

export default async function BayarPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isFinite(orderId)) notFound();

  const session = await requireSession();
  const o = await db.query.orderHeader.findFirst({ where: eq(orderHeader.id, orderId) });
  if (!o) notFound();

  // Verifikasi kepemilikan
  const pel = o.pelangganId
    ? await db.query.pelanggan.findFirst({ where: eq(pelangganTable.id, o.pelangganId) })
    : null;
  if (!pel || pel.userId !== session.user.id) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
        Order ini bukan milik Anda.
      </div>
    );
  }

  const items = await db.query.orderItem.findMany({ where: eq(orderItem.orderId, orderId) });
  const totalGalonOrder = items.reduce((s, it) => s + it.qty, 0);
  const subtotalOrder = items.reduce((s, it) => s + it.hargaEstimasi * it.qty, 0);
  const hargaPerGalon = totalGalonOrder > 0 ? Math.round(subtotalOrder / totalGalonOrder) : 0;

  const cfg = await db.query.pengaturan.findMany();
  const cfgMap = Object.fromEntries(cfg.map((r) => [r.key, r.value ?? ""]));

  const rekeningList = (cfgMap.daftarRekening ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [bank, nomor, atasNama] = line.split("|").map((s) => s.trim());
      return { bank, nomor, atasNama };
    });

  return (
    <div className="space-y-4">
      <Link
        href="/pelanggan/riwayat"
        className="inline-flex items-center gap-1 text-sm text-[color:var(--muted)] hover:text-ink"
      >
        <ArrowLeft size={16} /> Riwayat
      </Link>

      <div className="bg-surface border border-line rounded-2xl p-5">
        <div className="text-[11px] text-[color:var(--muted)] font-mono">{o.nomorOrder}</div>
        <div className="text-3xl font-extrabold text-brand mt-1 tracking-tight">
          {formatRupiah(o.totalEstimasi - o.loyaltiDipakai)}
        </div>
        {o.loyaltiDipakai > 0 && (
          <div className="text-xs text-[color:var(--muted)] mt-1">
            Total {formatRupiah(o.totalEstimasi)} − saldo{" "}
            <span className="text-emerald-600 font-bold">
              {formatRupiah(o.loyaltiDipakai)}
            </span>
          </div>
        )}
        <div className="mt-2">
          <PaymentStatusBadge status={o.statusBayar} />
        </div>
      </div>

      {o.statusBayar === "lunas" ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-emerald-800 text-sm flex items-start gap-3">
          <CheckCircle2 size={20} className="mt-0.5 flex-shrink-0" />
          <div>
            <div className="font-extrabold">Pembayaran sudah dikonfirmasi ✓</div>
            {o.bayarAt && (
              <div className="text-xs mt-1 opacity-90">
                Lunas pada{" "}
                {new Date(o.bayarAt).toLocaleString("id-ID", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </div>
            )}
          </div>
        </div>
      ) : o.statusBayar === "menunggu" ? (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-amber-800 text-sm space-y-3">
          <div className="flex items-start gap-3">
            <Clock size={20} className="mt-0.5 flex-shrink-0" />
            <div>
              <div className="font-extrabold">Bukti pembayaran sedang diverifikasi</div>
              <div className="text-xs mt-1 opacity-90">
                Admin akan cek mutasi dan konfirmasi maksimal 1×24 jam. Anda akan dapat
                notifikasi WhatsApp setelah dikonfirmasi.
              </div>
            </div>
          </div>
          {o.buktiBayarUrl && (
            <a
              href={o.buktiBayarUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-block text-xs underline font-semibold"
            >
              Lihat bukti yang Anda kirim →
            </a>
          )}
        </div>
      ) : (
        <BayarClient
          orderId={o.id}
          nomorOrder={o.nomorOrder}
          total={o.totalEstimasi - o.loyaltiDipakai}
          totalAsli={o.totalEstimasi}
          loyaltiDipakai={o.loyaltiDipakai}
          saldoLoyalti={pel.saldoLoyalti}
          metodeBayar={o.metodeBayar}
          buktiUrl={o.buktiBayarUrl}
          qrisFotoUrl={cfgMap.qrisFotoUrl ?? null}
          nomorDana={cfgMap.nomorDana ?? null}
          atasNamaDana={cfgMap.atasNamaDana ?? null}
          rekeningList={rekeningList}
          totalGalon={totalGalonOrder}
          hargaPerGalon={hargaPerGalon}
        />
      )}
    </div>
  );
}

function PaymentStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    belum: { label: "Belum dibayar", cls: "bg-[color:var(--surface2)] text-ink" },
    menunggu: { label: "Menunggu verifikasi", cls: "bg-amber-100 text-amber-800" },
    lunas: { label: "✓ Lunas", cls: "bg-emerald-100 text-emerald-800" },
  };
  const m = map[status] ?? map.belum;
  return (
    <span className={`inline-block text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wide ${m.cls}`}>
      {m.label}
    </span>
  );
}
