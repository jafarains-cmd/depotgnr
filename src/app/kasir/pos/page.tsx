import { db } from "@/db";
import { eq, inArray } from "drizzle-orm";
import { produk } from "@/db/schema/produk";
import { orderHeader, orderItem } from "@/db/schema/order";
import { user as userTable } from "@/db/schema/auth";
import { PageHeader } from "@/components/AppShell";
import { POSClient, type Preset } from "./POSClient";

export const dynamic = "force-dynamic";

export default async function POSPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string }>;
}) {
  const sp = await searchParams;
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
      <POSClient
        produkList={produkList}
        pelangganList={pelangganList.map((p) => ({
          id: p.id,
          nama: p.nama,
          telp: p.telp,
          alamat: p.alamat,
        }))}
        kurirList={kurirList}
        preset={preset}
      />
    </div>
  );
}
