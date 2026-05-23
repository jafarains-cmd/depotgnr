import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { eq, asc } from "drizzle-orm";
import { db } from "@/db";
import { komplain, komplainPesan } from "@/db/schema/komplain";
import { pelanggan as pelangganTable } from "@/db/schema/pelanggan";
import { user as userTable } from "@/db/schema/auth";
import { orderHeader } from "@/db/schema/order";
import { requireSession } from "@/lib/permissions";
import { formatRupiah } from "@/lib/utils";
import { KomplainThread, type Pesan } from "./Thread";

export const dynamic = "force-dynamic";

const JENIS_LABEL: Record<string, string> = {
  kotor: "Galon kotor / kemasan rusak",
  rusak: "Air berbau / rasa aneh",
  kurang_volume: "Volume kurang",
  salah_pesanan: "Pesanan tidak sesuai",
  lainnya: "Lainnya",
};

const STATUS_STYLE: Record<string, string> = {
  baru: "bg-amber-100 text-amber-800",
  diproses: "bg-blue-100 text-blue-800",
  selesai: "bg-emerald-100 text-emerald-800",
  ditolak: "bg-rose-100 text-rose-800",
};

export default async function KomplainDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const isStaff = session.user.role === "admin" || session.user.role === "kasir";
  const meRole: "pelanggan" | "staff" = isStaff ? "staff" : "pelanggan";

  const { id } = await params;
  const komplainId = Number(id);
  if (!komplainId) notFound();

  const k = await db.query.komplain.findFirst({ where: eq(komplain.id, komplainId) });
  if (!k) notFound();

  // Otorisasi: pelanggan hanya boleh akses komplain miliknya
  const pel = await db.query.pelanggan.findFirst({
    where: eq(pelangganTable.id, k.pelangganId),
  });
  if (!isStaff && pel?.userId !== session.user.id) notFound();

  // Ambil thread + sender info
  const rawPesan = await db
    .select({
      id: komplainPesan.id,
      senderUserId: komplainPesan.senderUserId,
      senderRole: komplainPesan.senderRole,
      pesan: komplainPesan.pesan,
      createdAt: komplainPesan.createdAt,
      senderNama: userTable.name,
    })
    .from(komplainPesan)
    .leftJoin(userTable, eq(komplainPesan.senderUserId, userTable.id))
    .where(eq(komplainPesan.komplainId, komplainId))
    .orderBy(asc(komplainPesan.createdAt));

  const pesanList: Pesan[] = rawPesan.map((p) => ({
    id: p.id,
    senderUserId: p.senderUserId,
    senderRole: p.senderRole as "pelanggan" | "staff",
    senderNama: p.senderNama ?? "-",
    pesan: p.pesan,
    createdAt: p.createdAt.toISOString(),
  }));

  const refOrder = k.refOrderId
    ? await db.query.orderHeader.findFirst({ where: eq(orderHeader.id, k.refOrderId) })
    : null;

  const backUrl = isStaff ? "/admin/komplain" : "/pelanggan/komplain";

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
      <Link
        href={backUrl}
        className="text-sm text-[color:var(--muted)] hover:text-brand inline-flex items-center gap-1"
      >
        <ArrowLeft size={14} /> Kembali ke Komplain
      </Link>

      {/* Header komplain */}
      <div className="bg-surface border border-line rounded-2xl p-4 space-y-2">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="text-xs text-[color:var(--muted)]">Komplain #{k.id}</div>
            <div className="font-extrabold text-lg">{JENIS_LABEL[k.jenis] ?? k.jenis}</div>
            <div className="text-xs text-[color:var(--muted)]">
              {k.createdAt.toLocaleString("id-ID", {
                day: "2-digit",
                month: "long",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          </div>
          <span
            className={`text-xs px-3 py-1 rounded-full font-extrabold ${
              STATUS_STYLE[k.status] ?? "bg-gray-100 text-gray-800"
            }`}
          >
            {k.status.toUpperCase()}
          </span>
        </div>

        <div className="text-sm bg-[color:var(--surface2)] rounded-md p-3 whitespace-pre-wrap">
          {k.deskripsi}
        </div>

        {refOrder && (
          <div className="text-xs">
            <span className="text-[color:var(--muted)]">Order terkait: </span>
            <Link
              href={isStaff ? `/kasir/order` : `/pelanggan/riwayat`}
              className="font-mono text-brand font-bold"
            >
              {refOrder.nomorOrder}
            </Link>
          </div>
        )}

        {isStaff && pel && (
          <div className="text-xs text-[color:var(--muted)] pt-2 border-t border-line">
            👤 <b>{pel.nama}</b>
            {pel.telp && ` · 📞 ${pel.telp}`}
          </div>
        )}

        {k.resolusi && (
          <div className="mt-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm">
            <div className="text-[10px] font-bold tracking-widest text-emerald-700">
              RESOLUSI
            </div>
            <div className="text-emerald-900 mt-0.5 whitespace-pre-wrap">{k.resolusi}</div>
            {k.kompensasiLoyalti > 0 && (
              <div className="text-xs text-emerald-700 mt-1">
                Kompensasi loyalty: <b>{formatRupiah(k.kompensasiLoyalti)}</b>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Thread chat */}
      <KomplainThread komplainId={k.id} pesanList={pesanList} meRole={meRole} />
    </div>
  );
}
