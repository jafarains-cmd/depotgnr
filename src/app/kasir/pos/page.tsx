import Link from "next/link";
import { db } from "@/db";
import { eq, inArray } from "drizzle-orm";
import { produk } from "@/db/schema/produk";
import { orderHeader, orderItem } from "@/db/schema/order";
import { user as userTable } from "@/db/schema/auth";
import { PageHeader } from "@/components/AppShell";
import { POSClient, type Preset } from "./POSClient";
import { requireRole } from "@/lib/permissions";
import { getShiftAktif } from "@/lib/shift";
import { AlertTriangle, Play } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function POSPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string }>;
}) {
  const session = await requireRole(["admin", "kasir"]);
  const sp = await searchParams;
  const shiftAktif = await getShiftAktif(session.user.id);
  const [produkList, pelangganList, kurirList] = await Promise.all([
    db.query.produk.findMany({ where: eq(produk.aktif, true), orderBy: (p, { asc }) => [asc(p.id)] }),
    db.query.pelanggan.findMany({ orderBy: (p, { asc }) => [asc(p.nama)] }),
    db
      .select({ id: userTable.id, name: userTable.name })
      .from(userTable)
      .where(inArray(userTable.role, ["kurir", "admin", "kasir"])),
  ]);

  let preset: Preset | undefined;
  if (sp.orderId) {
    const orderId = Number(sp.orderId);
    const order = await db.query.orderHeader.findFirst({ where: eq(orderHeader.id, orderId) });
    if (order) {
      const items = await db.query.orderItem.findMany({
        where: eq(orderItem.orderId, orderId),
      });
      const produkMap = new Map(produkList.map((p) => [p.id, p]));
      preset = {
        refOrderId: order.id,
        nomorOrder: order.nomorOrder,
        pelangganId: order.pelangganId,
        cart: items
          .map((it) => {
            const p = produkMap.get(it.produkId);
            if (!p) return null;
            const harga =
              it.jenis === "isi_ulang"
                ? p.hargaIsiUlang
                : it.jenis === "tukar"
                  ? p.hargaTukar
                  : p.hargaBeliBaru;
            return { produkId: it.produkId, qty: it.qty, hargaSatuan: harga, jenis: it.jenis };
          })
          .filter((x): x is NonNullable<typeof x> => x !== null),
      };
    }
  }

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title="POS Kasir"
        description={
          preset
            ? `Membuat nota dari order ${preset.nomorOrder}.`
            : "Catat transaksi penjualan/isi ulang."
        }
      />
      {!shiftAktif ? (
        <Link
          href="/kasir/shift"
          className="block bg-amber-50 border border-amber-300 rounded-2xl p-3 mb-4 hover:bg-amber-100"
        >
          <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
            <AlertTriangle size={16} /> Belum buka shift kasir
          </div>
          <div className="text-xs text-amber-800 mt-1 inline-flex items-center gap-1">
            <Play size={12} /> Klik untuk buka shift dulu sebelum input transaksi
          </div>
        </Link>
      ) : (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2 mb-4 text-[11px] text-emerald-800 inline-flex items-center gap-1.5">
          🟢 Shift aktif sejak{" "}
          {shiftAktif.openedAt.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
        </div>
      )}
      <POSClient
        produkList={produkList}
        pelangganList={pelangganList.map((p) => ({
          id: p.id,
          nama: p.nama,
          telp: p.telp,
          alamat: p.alamat,
          saldoLoyalti: p.saldoLoyalti,
        }))}
        kurirList={kurirList}
        preset={preset}
      />
    </div>
  );
}
