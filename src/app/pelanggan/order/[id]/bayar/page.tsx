import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { ArrowLeft, CheckCircle2, Clock } from "lucide-react";
import { db } from "@/db";
import { orderHeader } from "@/db/schema/order";
import { pelanggan as pelangganTable } from "@/db/schema/pelanggan";
import { pengaturan } from "@/db/schema/pengaturan";
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
        className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft size={16} /> Riwayat
      </Link>

      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
        <div className="text-xs text-slate-500">{o.nomorOrder}</div>
        <div className="text-2xl font-bold">{formatRupiah(o.totalEstimasi)}</div>
        <PaymentStatusBadge status={o.statusBayar} />
      </div>

      {o.statusBayar === "lunas" ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-emerald-800 text-sm inline-flex items-start gap-2">
          <CheckCircle2 size={18} className="mt-0.5 flex-shrink-0" />
          <div>
            <div className="font-semibold">Pembayaran sudah dikonfirmasi</div>
            {o.bayarAt && (
              <div className="text-xs">
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
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-800 text-sm space-y-2">
          <div className="inline-flex items-start gap-2">
            <Clock size={18} className="mt-0.5 flex-shrink-0" />
            <div>
              <div className="font-semibold">Bukti pembayaran sedang diverifikasi</div>
              <div className="text-xs">
                Admin akan cek mutasi dan konfirmasi maksimal 1×24 jam. Anda akan
                mendapat notifikasi WhatsApp setelah dikonfirmasi.
              </div>
            </div>
          </div>
          {o.buktiBayarUrl && (
            <a
              href={o.buktiBayarUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-block text-xs underline"
            >
              Lihat bukti yang Anda kirim
            </a>
          )}
        </div>
      ) : (
        <BayarClient
          orderId={o.id}
          nomorOrder={o.nomorOrder}
          total={o.totalEstimasi}
          metodeBayar={o.metodeBayar}
          buktiUrl={o.buktiBayarUrl}
          qrisFotoUrl={cfgMap.qrisFotoUrl ?? null}
          nomorDana={cfgMap.nomorDana ?? null}
          atasNamaDana={cfgMap.atasNamaDana ?? null}
          rekeningList={rekeningList}
        />
      )}
    </div>
  );
}

function PaymentStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    belum: { label: "Belum dibayar", cls: "bg-slate-100 text-slate-700" },
    menunggu: { label: "Menunggu verifikasi", cls: "bg-amber-100 text-amber-800" },
    lunas: { label: "Lunas", cls: "bg-emerald-100 text-emerald-800" },
  };
  const m = map[status] ?? map.belum;
  return (
    <span className={`inline-block text-xs px-2 py-0.5 rounded ${m.cls}`}>{m.label}</span>
  );
}
