import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { transaksi, transaksiItem } from "@/db/schema/transaksi";
import { orderHeader, orderItem } from "@/db/schema/order";
import { pelanggan as pelangganTable } from "@/db/schema/pelanggan";
import { user as userTable } from "@/db/schema/auth";
import { stokGalon, mutasiStok } from "@/db/schema/inventory";
import { generateTrackingToken } from "@/lib/tracking";
import { earnLoyalty, getLoyaltyConfig } from "@/lib/loyalty";
import { recordKurirBonus } from "@/lib/bonus";
import { bestEffort } from "@/lib/best-effort";
import { ensureKodeReferral } from "@/lib/loyalty";

export const dynamic = "force-dynamic";

const SHEET_SYNC_SECRET = process.env.SHEET_SYNC_SECRET ?? "";

type TrxItem = {
  produkId: number;
  jenis: "isi_ulang" | "tukar" | "beli_baru";
  qty: number;
  hargaSatuan: number;
};

type Body = {
  transaksi?: Array<{
    nomorNota: string;
    pelangganTelp?: string | null;
    pelangganNama?: string | null;
    items: TrxItem[];
    metodeBayar: "cash" | "transfer" | "qris";
    catatan?: string;
    createdAt?: string;
  }>;
  orderAntar?: Array<{
    nomorOrder: string;
    pelangganTelp: string;
    pelangganNama?: string;
    alamatAntar: string;
    items: TrxItem[];
    metodeBayar?: "cash" | "transfer" | "qris";
    statusBayar?: "lunas" | "belum";
    catatan?: string;
    createdAt?: string;
  }>;
  pelangganBaru?: Array<{
    nama: string;
    telp?: string;
    alamat?: string;
    tipe?: "umum" | "langganan";
  }>;
};

type ItemResult = {
  ref: string;
  status: "synced" | "skipped" | "error";
  reason?: string;
};

/** Coerce nilai jadi string + trim. Sheets sering kasih number untuk telp. */
function s(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}
function sOrNull(v: unknown): string | null {
  const t = s(v);
  return t || null;
}

/**
 * Sync data dari Google Spreadsheet ke aplikasi.
 * Dipanggil oleh Apps Script saat aplikasi recover dari downtime.
 *
 * Auth: header `X-Sheet-Sync-Secret` harus match env SHEET_SYNC_SECRET.
 *
 * Idempotent: kalau nomor nota/order sudah ada di DB, di-skip dengan reason
 * "duplicate". Aman dipanggil berulang.
 *
 * Stok: di-adjust normal saat insert transaksi/order baru (sama dengan POS).
 * Loyalty earn + bonus kurir di-trigger best-effort.
 */
export async function POST(req: Request) {
  if (!SHEET_SYNC_SECRET) {
    return NextResponse.json(
      { error: "SHEET_SYNC_SECRET belum diset di server" },
      { status: 500 },
    );
  }

  const headerSecret = req.headers.get("x-sheet-sync-secret");
  if (headerSecret !== SHEET_SYNC_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Body bukan JSON valid" }, { status: 400 });
  }

  // Resolve sync user (admin pertama atau lookup by env SHEET_SYNC_USER_ID)
  const syncUserId = await resolveSyncUserId();
  if (!syncUserId) {
    return NextResponse.json(
      { error: "Tidak ada admin di sistem untuk dipakai sebagai kasir sync" },
      { status: 500 },
    );
  }

  const results: {
    transaksi: ItemResult[];
    orderAntar: ItemResult[];
    pelangganBaru: ItemResult[];
  } = {
    transaksi: [],
    orderAntar: [],
    pelangganBaru: [],
  };

  // 1. Pelanggan baru (proses dulu supaya transaksi/order bisa pakai)
  for (const p of body.pelangganBaru ?? []) {
    const nama = s(p.nama);
    if (!nama) {
      results.pelangganBaru.push({ ref: nama || "(kosong)", status: "error", reason: "nama wajib" });
      continue;
    }
    try {
      const telp = sOrNull(p.telp);
      // Cek by telp kalau ada
      let existing = null;
      if (telp) {
        existing = await db.query.pelanggan.findFirst({
          where: eq(pelangganTable.telp, telp),
        });
      }
      if (existing) {
        results.pelangganBaru.push({ ref: nama, status: "skipped", reason: "telp sudah ada" });
        continue;
      }
      const [created] = await db
        .insert(pelangganTable)
        .values({
          nama,
          telp,
          alamat: sOrNull(p.alamat),
          tipe: p.tipe ?? "umum",
        })
        .returning();
      bestEffort(`ensureKodeReferral(${created.id})`, ensureKodeReferral(created.id));
      results.pelangganBaru.push({ ref: nama, status: "synced" });
    } catch (e) {
      results.pelangganBaru.push({
        ref: nama,
        status: "error",
        reason: e instanceof Error ? e.message : "unknown",
      });
    }
  }

  // 2. Transaksi POS
  for (const t of body.transaksi ?? []) {
    if (!t.nomorNota) {
      results.transaksi.push({ ref: "(no-nomor)", status: "error", reason: "nomorNota wajib" });
      continue;
    }
    try {
      // Idempotency
      const existing = await db.query.transaksi.findFirst({
        where: eq(transaksi.nomorNota, t.nomorNota),
      });
      if (existing) {
        results.transaksi.push({ ref: t.nomorNota, status: "skipped", reason: "duplicate" });
        continue;
      }

      const pelangganId = await resolvePelangganId(t.pelangganTelp, t.pelangganNama);
      const subtotal = t.items.reduce((s, it) => s + it.hargaSatuan * it.qty, 0);
      const created = t.createdAt ? new Date(t.createdAt) : new Date();

      const trxId = db.transaction((tx) => {
        const [trx] = tx
          .insert(transaksi)
          .values({
            nomorNota: t.nomorNota,
            kasirUserId: syncUserId,
            pelangganId,
            subtotal,
            diskon: 0,
            total: subtotal,
            metodeBayar: t.metodeBayar,
            status: "lunas",
            catatan: t.catatan ? `[SYNC-SHEET] ${t.catatan}` : "[SYNC-SHEET] Backup dari spreadsheet",
            createdAt: created,
          })
          .returning()
          .all();

        for (const it of t.items) {
          tx.insert(transaksiItem)
            .values({
              transaksiId: trx.id,
              produkId: it.produkId,
              qty: it.qty,
              hargaSatuan: it.hargaSatuan,
              subtotal: it.hargaSatuan * it.qty,
              jenis: it.jenis,
            })
            .run();
          adjustStok(tx, it.produkId, "terisi", -it.qty, it.jenis, trx.id, null, syncUserId);
          if (it.jenis === "tukar") {
            adjustStok(tx, it.produkId, "kosong", +it.qty, it.jenis, trx.id, null, syncUserId);
          }
        }
        return trx.id;
      });

      // Earn loyalty best-effort
      if (pelangganId) {
        const totalGalon = t.items.reduce((s, it) => s + it.qty, 0);
        const cfg = await getLoyaltyConfig();
        bestEffort(
          `earnLoyalty(${t.nomorNota})`,
          earnLoyalty({
            pelangganId,
            jumlahGalon: totalGalon,
            rate: cfg.ratePerGalonDepot,
            refTransaksiId: trxId,
            deskripsi: `Earn dari ${t.nomorNota} (sync sheet)`,
          }),
        );
      }

      results.transaksi.push({ ref: t.nomorNota, status: "synced" });
    } catch (e) {
      results.transaksi.push({
        ref: t.nomorNota,
        status: "error",
        reason: e instanceof Error ? e.message : "unknown",
      });
    }
  }

  // 3. Order Antar
  for (const o of body.orderAntar ?? []) {
    if (!o.nomorOrder) {
      results.orderAntar.push({ ref: "(no-nomor)", status: "error", reason: "nomorOrder wajib" });
      continue;
    }
    try {
      const existing = await db.query.orderHeader.findFirst({
        where: eq(orderHeader.nomorOrder, o.nomorOrder),
      });
      if (existing) {
        results.orderAntar.push({ ref: o.nomorOrder, status: "skipped", reason: "duplicate" });
        continue;
      }

      const pelangganId = await resolvePelangganId(o.pelangganTelp, o.pelangganNama);
      const totalEstimasi = o.items.reduce((s, it) => s + it.hargaSatuan * it.qty, 0);
      const created = o.createdAt ? new Date(o.createdAt) : new Date();
      const isLunas = o.statusBayar === "lunas";

      const orderId = db.transaction((tx) => {
        const [created2] = tx
          .insert(orderHeader)
          .values({
            nomorOrder: o.nomorOrder,
            pelangganId,
            sumber: "walk-in",
            alamatAntar: o.alamatAntar,
            status: "selesai",
            diantarAt: created,
            selesaiAt: created,
            tipePengantaran: "antar-saja",
            totalEstimasi,
            catatan: o.catatan ? `[SYNC-SHEET] ${o.catatan}` : "[SYNC-SHEET] Backup dari spreadsheet",
            metodeBayar: o.metodeBayar ?? null,
            statusBayar: isLunas ? "lunas" : "belum",
            bayarAt: isLunas ? created : null,
            bayarDikonfirmasiOleh: isLunas ? syncUserId : null,
            trackingToken: generateTrackingToken(),
            kurirUserId: syncUserId,
            createdAt: created,
          })
          .returning()
          .all();

        for (const it of o.items) {
          tx.insert(orderItem)
            .values({
              orderId: created2.id,
              produkId: it.produkId,
              qty: it.qty,
              jenis: it.jenis,
              hargaEstimasi: it.hargaSatuan,
            })
            .run();
          adjustStok(tx, it.produkId, "terisi", -it.qty, it.jenis, null, created2.id, syncUserId);
          if (it.jenis === "tukar") {
            adjustStok(tx, it.produkId, "kosong", +it.qty, it.jenis, null, created2.id, syncUserId);
          }
        }
        return created2.id;
      });

      // Bonus kurir kalau lunas (best-effort)
      if (isLunas) {
        bestEffort(`recordKurirBonus(${o.nomorOrder})`, recordKurirBonus(orderId));
      }

      results.orderAntar.push({ ref: o.nomorOrder, status: "synced" });
    } catch (e) {
      results.orderAntar.push({
        ref: o.nomorOrder,
        status: "error",
        reason: e instanceof Error ? e.message : "unknown",
      });
    }
  }

  return NextResponse.json({
    ok: true,
    summary: {
      transaksi: countResults(results.transaksi),
      orderAntar: countResults(results.orderAntar),
      pelangganBaru: countResults(results.pelangganBaru),
    },
    details: results,
  });
}

function countResults(arr: ItemResult[]) {
  return {
    synced: arr.filter((r) => r.status === "synced").length,
    skipped: arr.filter((r) => r.status === "skipped").length,
    error: arr.filter((r) => r.status === "error").length,
  };
}

async function resolveSyncUserId(): Promise<string | null> {
  // Prioritas: SHEET_SYNC_USER_ID env (specific admin), fallback ke first admin
  const envId = process.env.SHEET_SYNC_USER_ID;
  if (envId) {
    const u = await db.query.user.findFirst({ where: eq(userTable.id, envId) });
    if (u) return u.id;
  }
  const admin = await db.query.user.findFirst({
    where: eq(userTable.role, "admin"),
  });
  return admin?.id ?? null;
}

async function resolvePelangganId(
  telpRaw: unknown,
  namaRaw: unknown,
): Promise<number | null> {
  const telp = s(telpRaw);
  const nama = s(namaRaw);
  if (telp) {
    const existing = await db.query.pelanggan.findFirst({
      where: eq(pelangganTable.telp, telp),
    });
    if (existing) return existing.id;
    // Auto-create kalau telp diberi tapi belum ada
    if (nama) {
      const [created] = await db
        .insert(pelangganTable)
        .values({
          nama,
          telp,
          tipe: "umum",
        })
        .returning();
      return created.id;
    }
  }
  return null;
}

function adjustStok(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  produkId: number,
  status: "kosong" | "terisi" | "rusak",
  delta: number,
  alasanJenis: "isi_ulang" | "tukar" | "beli_baru",
  refTrxId: number | null,
  refOrderId: number | null,
  userId: string,
) {
  const existing = tx
    .select()
    .from(stokGalon)
    .where(and(eq(stokGalon.produkId, produkId), eq(stokGalon.status, status)))
    .all();
  const row = existing[0];
  if (row) {
    tx.update(stokGalon)
      .set({ jumlah: Math.max(0, row.jumlah + delta), updatedAt: new Date() })
      .where(eq(stokGalon.id, row.id))
      .run();
  } else {
    tx.insert(stokGalon)
      .values({ produkId, status, jumlah: Math.max(0, delta) })
      .run();
  }
  tx.insert(mutasiStok)
    .values({
      produkId,
      status,
      perubahan: delta,
      alasan: refTrxId ? `sync-sheet:trx:${alasanJenis}` : `sync-sheet:order:${alasanJenis}`,
      refTransaksiId: refTrxId,
      refOrderId,
      userId,
    })
    .run();
}

// Master data: pelanggan & produk untuk dropdown di Apps Script
export async function GET(req: Request) {
  if (!SHEET_SYNC_SECRET) {
    return NextResponse.json({ error: "SHEET_SYNC_SECRET belum diset" }, { status: 500 });
  }
  const headerSecret = req.headers.get("x-sheet-sync-secret");
  if (headerSecret !== SHEET_SYNC_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pelangganList = await db
    .select({
      id: pelangganTable.id,
      nama: pelangganTable.nama,
      telp: pelangganTable.telp,
      alamat: pelangganTable.alamat,
    })
    .from(pelangganTable)
    .orderBy(pelangganTable.nama)
    .limit(2000);

  // Produk + 3 harga
  const produkRows = await db.query.produk.findMany();
  const produkList = produkRows.map((p) => ({
    id: p.id,
    nama: p.nama,
    aktif: p.aktif,
    hargaIsiUlang: p.hargaIsiUlang,
    hargaTukar: p.hargaTukar,
    hargaBeliBaru: p.hargaBeliBaru,
  }));

  return NextResponse.json({
    ok: true,
    pelanggan: pelangganList,
    produk: produkList,
    timestamp: new Date().toISOString(),
  });
}
