import "dotenv/config";
import { db } from "./index";
import { produk } from "./schema/produk";
import { stokGalon } from "./schema/inventory";
import { pengaturan } from "./schema/pengaturan";

async function main() {
  console.log("→ Seeding produk...");
  const produkInserted = await db
    .insert(produk)
    .values([
      {
        nama: "Galon 19L",
        deskripsi: "Galon air minum standar 19 liter",
        hargaIsiUlang: 6000,
        hargaTukar: 20000,
        hargaBeliBaru: 55000,
      },
      {
        nama: "Galon 5L",
        deskripsi: "Galon kecil 5 liter",
        hargaIsiUlang: 3000,
        hargaTukar: 10000,
        hargaBeliBaru: 25000,
      },
      {
        nama: "Botol 1.5L",
        deskripsi: "Air kemasan 1.5 liter",
        hargaIsiUlang: 0,
        hargaTukar: 0,
        hargaBeliBaru: 5000,
      },
    ])
    .onConflictDoNothing()
    .returning();

  console.log(`  ✓ ${produkInserted.length} produk`);

  console.log("→ Seeding stok awal...");
  for (const p of produkInserted) {
    await db
      .insert(stokGalon)
      .values([
        { produkId: p.id, status: "terisi", jumlah: 50 },
        { produkId: p.id, status: "kosong", jumlah: 30 },
        { produkId: p.id, status: "rusak", jumlah: 0 },
      ])
      .onConflictDoNothing();
  }

  console.log("→ Seeding pengaturan default...");
  await db
    .insert(pengaturan)
    .values([
      { key: "namaDepot", value: "Depot Air Minum" },
      { key: "alamatDepot", value: "" },
      { key: "telpDepot", value: "" },
      {
        key: "templateNotifOrderMasukAdmin",
        value:
          "🔔 *Order Baru* {nomorOrder}\nPelanggan: {namaPelanggan}\nTotal item: {jumlahItem}\nEstimasi: {totalEstimasi}\nAlamat: {alamatAntar}",
      },
      {
        key: "templateNotifOrderSelesaiPelanggan",
        value:
          "✅ Order *{nomorOrder}* sudah selesai/diantar.\nTotal: {total}\nTerima kasih sudah berbelanja di {namaDepot}!",
      },
      { key: "googleSheetId", value: "" },
      { key: "syncing", value: "false" },
    ])
    .onConflictDoNothing();

  console.log("✓ Seed selesai.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
