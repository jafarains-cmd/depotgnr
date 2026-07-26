"use server";

import { revalidatePath } from "next/cache";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/db";
import {
  pembelianGalon,
  supplier as supplierTable,
} from "@/db/schema/pembelian";
import { stokGalon, mutasiStok } from "@/db/schema/inventory";
import { pengeluaran } from "@/db/schema/pengeluaran";
import { produk } from "@/db/schema/produk";
import { requireRole } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { uploadAsset } from "@/lib/drive";

// ═══════════════════════════════════════════════════════════
// SUPPLIER CRUD
// ═══════════════════════════════════════════════════════════

export async function saveSupplier(input: {
  id?: number;
  nama: string;
  telp?: string;
  alamat?: string;
  catatan?: string;
  aktif?: boolean;
}): Promise<{ ok: true; id: number } | { error: string }> {
  const session = await requireRole(["admin"]);
  const nama = input.nama.trim();
  if (nama.length < 2) return { error: "Nama supplier min 2 karakter" };

  const data = {
    nama,
    telp: input.telp?.trim() || null,
    alamat: input.alamat?.trim() || null,
    catatan: input.catatan?.trim() || null,
    aktif: input.aktif ?? true,
    updatedAt: new Date(),
  };

  if (input.id) {
    await db.update(supplierTable).set(data).where(eq(supplierTable.id, input.id));
    await logAudit({
      actorUserId: session.user.id,
      action: "supplier.update",
      entity: "supplier",
      entityId: input.id,
      after: data,
    });
    revalidatePath("/admin/inventory/pembelian");
    return { ok: true, id: input.id };
  }

  const [row] = await db
    .insert(supplierTable)
    .values(data)
    .returning({ id: supplierTable.id });
  await logAudit({
    actorUserId: session.user.id,
    action: "supplier.create",
    entity: "supplier",
    entityId: row.id,
    after: data,
  });
  revalidatePath("/admin/inventory/pembelian");
  return { ok: true, id: row.id };
}

export async function toggleSupplierAktif(
  id: number,
): Promise<{ ok: true } | { error: string }> {
  const session = await requireRole(["admin"]);
  const row = await db.query.supplier.findFirst({
    where: eq(supplierTable.id, id),
  });
  if (!row) return { error: "Supplier tidak ditemukan" };
  await db
    .update(supplierTable)
    .set({ aktif: !row.aktif, updatedAt: new Date() })
    .where(eq(supplierTable.id, id));
  await logAudit({
    actorUserId: session.user.id,
    action: "supplier.toggle-aktif",
    entity: "supplier",
    entityId: id,
    before: { aktif: row.aktif },
    after: { aktif: !row.aktif },
  });
  revalidatePath("/admin/inventory/pembelian");
  return { ok: true };
}

// ═══════════════════════════════════════════════════════════
// PEMBELIAN GALON
// ═══════════════════════════════════════════════════════════

/**
 * Catat pembelian galon. Side effects (dalam 1 transaction):
 *  1. Insert pembelian_galon
 *  2. Update stokGalon (kosong atau terisi sesuai jenis)
 *  3. Insert mutasi_stok (audit trail)
 *  4. Insert pengeluaran (auto kategori "beli-galon")
 *  5. Update produk.hargaPokok = hargaSatuan
 *  6. Link pembelian.refPengeluaranId = pengeluaran.id
 */
export async function catatPembelianGalon(input: {
  tanggal: string; // ISO date
  produkId: number;
  supplierId?: number | null;
  jenis: "kosong" | "terisi";
  jumlah: number;
  hargaSatuan: number;
  noInvoice?: string;
  catatan?: string;
  fotoNotaBase64?: string;
  fotoNotaMimeType?: string;
}): Promise<{ ok: true; id: number } | { error: string }> {
  const session = await requireRole(["admin"]);

  const tanggal = new Date(input.tanggal);
  if (isNaN(tanggal.getTime())) return { error: "Tanggal tidak valid" };
  if (!input.produkId) return { error: "Produk wajib dipilih" };
  if (!["kosong", "terisi"].includes(input.jenis)) {
    return { error: "Jenis harus kosong atau terisi" };
  }
  const jumlah = Math.floor(input.jumlah);
  const hargaSatuan = Math.floor(input.hargaSatuan);
  if (!Number.isFinite(jumlah) || jumlah <= 0) {
    return { error: "Jumlah harus > 0" };
  }
  if (!Number.isFinite(hargaSatuan) || hargaSatuan <= 0) {
    return { error: "Harga per galon harus > 0" };
  }

  // Cek produk exist
  const prod = await db.query.produk.findFirst({
    where: eq(produk.id, input.produkId),
  });
  if (!prod) return { error: "Produk tidak ditemukan" };

  // Upload foto nota (best-effort)
  let fotoUrl: string | null = null;
  if (input.fotoNotaBase64 && input.fotoNotaMimeType) {
    const up = await uploadAsset({
      prefix: `nota-pembelian-galon`,
      base64: input.fotoNotaBase64,
      mimeType: input.fotoNotaMimeType,
    });
    if (up.ok && up.url) fotoUrl = up.url;
  }

  const totalHarga = jumlah * hargaSatuan;
  const now = new Date();
  const supplierNama = input.supplierId
    ? (await db.query.supplier.findFirst({
        where: eq(supplierTable.id, input.supplierId),
      }))?.nama ?? "—"
    : "—";

  // Transaction: semua atau tidak sama sekali
  const result = db.transaction((tx) => {
    // 1. Insert pengeluaran dulu supaya dapat ID untuk link
    const [pengRow] = tx
      .insert(pengeluaran)
      .values({
        tanggal,
        kategori: "beli-galon",
        jumlah: totalHarga,
        deskripsi: `Beli ${jumlah} galon ${input.jenis} ${prod.nama}${supplierNama !== "—" ? ` dari ${supplierNama}` : ""}${input.noInvoice ? ` (${input.noInvoice})` : ""}`,
        fotoNotaUrl: fotoUrl,
        createdBy: session.user.id,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: pengeluaran.id })
      .all();

    // 2. Insert pembelian_galon dengan link ke pengeluaran
    const [pembRow] = tx
      .insert(pembelianGalon)
      .values({
        tanggal,
        produkId: input.produkId,
        supplierId: input.supplierId ?? null,
        jenis: input.jenis,
        jumlah,
        hargaSatuan,
        totalHarga,
        noInvoice: input.noInvoice?.trim() || null,
        fotoNotaUrl: fotoUrl,
        catatan: input.catatan?.trim() || null,
        refPengeluaranId: pengRow.id,
        createdBy: session.user.id,
        createdAt: now,
      })
      .returning({ id: pembelianGalon.id })
      .all();

    // 3. Update stok sesuai jenis
    const stokStatus = input.jenis === "kosong" ? "kosong" : "terisi";
    const existingStok = tx
      .select()
      .from(stokGalon)
      .where(and(eq(stokGalon.produkId, input.produkId), eq(stokGalon.status, stokStatus)))
      .all();
    if (existingStok.length > 0) {
      tx.update(stokGalon)
        .set({
          jumlah: (existingStok[0].jumlah ?? 0) + jumlah,
          updatedAt: now,
        })
        .where(eq(stokGalon.id, existingStok[0].id))
        .run();
    } else {
      tx.insert(stokGalon)
        .values({ produkId: input.produkId, status: stokStatus, jumlah })
        .run();
    }

    // 4. Insert mutasi stok
    tx.insert(mutasiStok)
      .values({
        produkId: input.produkId,
        status: stokStatus,
        perubahan: jumlah,
        alasan: `pembelian:${supplierNama}${input.noInvoice ? ` (${input.noInvoice})` : ""}`,
        userId: session.user.id,
        createdAt: now,
      })
      .run();

    // 5. Update harga pokok produk (harga pokok terakhir)
    tx.update(produk)
      .set({ hargaPokok: hargaSatuan, updatedAt: now })
      .where(eq(produk.id, input.produkId))
      .run();

    return pembRow.id;
  });

  await logAudit({
    actorUserId: session.user.id,
    action: "pembelian-galon.create",
    entity: "pembelian_galon",
    entityId: result,
    after: {
      produkId: input.produkId,
      jenis: input.jenis,
      jumlah,
      hargaSatuan,
      totalHarga,
      supplierId: input.supplierId,
    },
  });

  revalidatePath("/admin/inventory/pembelian");
  revalidatePath("/admin/inventory");
  revalidatePath("/admin/pengeluaran");
  revalidatePath("/admin/dashboard");
  return { ok: true, id: result };
}

export async function hapusPembelianGalon(
  id: number,
  alasan: string,
): Promise<{ ok: true } | { error: string }> {
  const session = await requireRole(["admin"]);
  const reason = alasan.trim();
  if (reason.length < 3) return { error: "Alasan wajib (min 3 karakter)" };

  const row = await db.query.pembelianGalon.findFirst({
    where: eq(pembelianGalon.id, id),
  });
  if (!row) return { error: "Pembelian tidak ditemukan" };

  db.transaction((tx) => {
    // Reverse stok
    const stokStatus = row.jenis === "kosong" ? "kosong" : "terisi";
    const existingStok = tx
      .select()
      .from(stokGalon)
      .where(and(eq(stokGalon.produkId, row.produkId), eq(stokGalon.status, stokStatus)))
      .all();
    if (existingStok.length > 0) {
      tx.update(stokGalon)
        .set({
          jumlah: Math.max(0, (existingStok[0].jumlah ?? 0) - row.jumlah),
          updatedAt: new Date(),
        })
        .where(eq(stokGalon.id, existingStok[0].id))
        .run();
    }

    // Mutasi reverse
    tx.insert(mutasiStok)
      .values({
        produkId: row.produkId,
        status: stokStatus,
        perubahan: -row.jumlah,
        alasan: `reverse-pembelian:${reason}`,
        userId: session.user.id,
      })
      .run();

    // Hapus pengeluaran linked (kalau masih ada)
    if (row.refPengeluaranId) {
      tx.delete(pengeluaran).where(eq(pengeluaran.id, row.refPengeluaranId)).run();
    }

    // Hapus pembelian record
    tx.delete(pembelianGalon).where(eq(pembelianGalon.id, id)).run();
  });

  await logAudit({
    actorUserId: session.user.id,
    action: "pembelian-galon.delete",
    entity: "pembelian_galon",
    entityId: id,
    before: {
      produkId: row.produkId,
      jenis: row.jenis,
      jumlah: row.jumlah,
      totalHarga: row.totalHarga,
    },
    meta: { alasan: reason },
  });

  revalidatePath("/admin/inventory/pembelian");
  revalidatePath("/admin/inventory");
  revalidatePath("/admin/pengeluaran");
  return { ok: true };
}

export async function listSupplier(): Promise<
  Array<{ id: number; nama: string; telp: string | null; aktif: boolean }>
> {
  await requireRole(["admin"]);
  return await db
    .select({
      id: supplierTable.id,
      nama: supplierTable.nama,
      telp: supplierTable.telp,
      aktif: supplierTable.aktif,
    })
    .from(supplierTable)
    .orderBy(desc(supplierTable.aktif), supplierTable.nama);
}
