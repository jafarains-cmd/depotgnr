"use server";

import { revalidatePath } from "next/cache";
import { and, eq, gte, lte, sql, isNull, inArray } from "drizzle-orm";
import { db } from "@/db";
import { rekonsiliasiBank } from "@/db/schema/rekonsiliasi-bank";
import { transaksi } from "@/db/schema/transaksi";
import { orderHeader } from "@/db/schema/order";
import { requireRole } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { uploadAsset } from "@/lib/drive";

type Metode = "transfer" | "qris";

function isMetodeValid(m: string): m is Metode {
  return m === "transfer" || m === "qris";
}

function startOfDay(iso: string): Date {
  const d = new Date(iso + "T00:00:00");
  d.setHours(0, 0, 0, 0);
  return d;
}
function endOfDay(iso: string): Date {
  const d = new Date(iso + "T23:59:59");
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Hitung omzet sistem untuk 1 hari + 1 metode (transfer / qris).
 *
 * Sumber:
 *  1. Transaksi POS langsung (refOrderId IS NULL) → createdAt in day
 *  2. Order lunas → bayarAt in day
 *
 * Untuk order.metodeBayar: transfer & dana → transfer, qris → qris.
 */
async function hitungOmzetSistem(tanggal: Date, metode: Metode): Promise<number> {
  const dayStart = new Date(tanggal);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(tanggal);
  dayEnd.setHours(23, 59, 59, 999);

  // 1. POS langsung
  const [posRow] = await db
    .select({
      total: sql<number>`coalesce(sum(${transaksi.total}), 0)`,
    })
    .from(transaksi)
    .where(
      and(
        isNull(transaksi.refOrderId),
        eq(transaksi.status, "lunas"),
        isNull(transaksi.voidedAt),
        eq(transaksi.metodeBayar, metode),
        gte(transaksi.createdAt, dayStart),
        lte(transaksi.createdAt, dayEnd),
      ),
    );

  // 2. Order lunas — map metode order → metode rekonsiliasi
  // transfer includes 'dana' (e-wallet fallback), qris hanya 'qris'
  const orderMetodeList =
    metode === "transfer"
      ? (["transfer", "dana"] as const)
      : (["qris"] as const);

  const [orderRow] = await db
    .select({
      total: sql<number>`coalesce(sum(${orderHeader.totalEstimasi}), 0)`,
    })
    .from(orderHeader)
    .where(
      and(
        eq(orderHeader.statusBayar, "lunas"),
        gte(orderHeader.bayarAt, dayStart),
        lte(orderHeader.bayarAt, dayEnd),
        inArray(orderHeader.metodeBayar, [...orderMetodeList]),
      ),
    );

  return Number(posRow?.total ?? 0) + Number(orderRow?.total ?? 0);
}

/**
 * Simpan verifikasi harian. Upsert: kalau sudah ada entry untuk (tanggal,metode),
 * update; kalau belum, insert baru.
 */
export async function verifikasiHarianAction(args: {
  tanggalIso: string; // YYYY-MM-DD
  metode: string;
  saldoAktual: number;
  catatan?: string;
  fotoBase64?: string | null;
  fotoMimeType?: string | null;
  hapusBuktiFoto?: boolean;
}): Promise<{ ok: true; id: number; selisih: number } | { error: string }> {
  try {
    const session = await requireRole(["admin"]);

    if (!isMetodeValid(args.metode)) {
      return { error: "Metode harus 'transfer' atau 'qris'" };
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(args.tanggalIso)) {
      return { error: "Tanggal tidak valid (format YYYY-MM-DD)" };
    }
    const saldo = Math.floor(args.saldoAktual);
    if (!Number.isFinite(saldo) || saldo < 0) {
      return { error: "Saldo aktual harus >= 0" };
    }

    const tanggal = startOfDay(args.tanggalIso);
    const omzetSistem = await hitungOmzetSistem(tanggal, args.metode);
    const selisih = saldo - omzetSistem;
    const catatan = (args.catatan ?? "").trim();

    if (selisih !== 0 && catatan.length < 3) {
      return {
        error: `Selisih ${selisih > 0 ? "+" : ""}${selisih.toLocaleString("id-ID")} terdeteksi — catatan wajib (min 3 karakter)`,
      };
    }

    const now = new Date();

    // Upsert
    const existing = await db.query.rekonsiliasiBank.findFirst({
      where: and(
        eq(rekonsiliasiBank.tanggal, tanggal),
        eq(rekonsiliasiBank.metode, args.metode),
      ),
    });

    // Handle foto: upload baru kalau ada, keep existing kalau tidak, atau hapus
    let buktiFotoUrl: string | null = existing?.buktiFotoUrl ?? null;
    if (args.hapusBuktiFoto) {
      buktiFotoUrl = null;
    } else if (args.fotoBase64 && args.fotoMimeType) {
      const up = await uploadAsset({
        prefix: `rekonsiliasi-${args.tanggalIso}-${args.metode}`,
        base64: args.fotoBase64,
        mimeType: args.fotoMimeType,
      });
      if (up.ok && up.url) buktiFotoUrl = up.url;
    }

    let recordId: number;
    const beforeSnapshot = existing
      ? {
          saldoAktual: existing.saldoAktual,
          selisih: existing.selisih,
          catatan: existing.catatan,
          buktiFotoUrl: existing.buktiFotoUrl,
        }
      : null;

    if (existing) {
      await db
        .update(rekonsiliasiBank)
        .set({
          omzetSistem,
          saldoAktual: saldo,
          selisih,
          catatan: catatan || null,
          buktiFotoUrl,
          verifiedBy: session.user.id,
          verifiedAt: now,
          updatedAt: now,
        })
        .where(eq(rekonsiliasiBank.id, existing.id));
      recordId = existing.id;
    } else {
      const [inserted] = await db
        .insert(rekonsiliasiBank)
        .values({
          tanggal,
          metode: args.metode,
          omzetSistem,
          saldoAktual: saldo,
          selisih,
          catatan: catatan || null,
          buktiFotoUrl,
          verifiedBy: session.user.id,
          verifiedAt: now,
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: rekonsiliasiBank.id });
      if (!inserted) return { error: "Gagal simpan verifikasi" };
      recordId = inserted.id;
    }

    await logAudit({
      actorUserId: session.user.id,
      action: existing ? "rekonsiliasi.update" : "rekonsiliasi.create",
      entity: "rekonsiliasi_bank",
      entityId: recordId,
      before: beforeSnapshot,
      after: {
        tanggal: args.tanggalIso,
        metode: args.metode,
        omzetSistem,
        saldoAktual: saldo,
        selisih,
        catatan: catatan || null,
        buktiFotoUrl,
      },
    });

    revalidatePath("/admin/rekonsiliasi");
    return { ok: true, id: recordId, selisih };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[verifikasiHarianAction] failed:", msg, err);
    // Hint kalau kolom belum ada di DB (migration belum applied)
    if (msg.toLowerCase().includes("no such column")) {
      return {
        error: `Kolom DB belum ada. Migration belum applied — hubungi admin server. Detail: ${msg}`,
      };
    }
    return { error: `Server error: ${msg}` };
  }
}

/**
 * Hapus verifikasi (kalau salah input, admin ingin verifikasi ulang).
 * Wajib alasan.
 */
export async function hapusVerifikasiAction(
  id: number,
  alasan: string,
): Promise<{ ok: true } | { error: string }> {
  const session = await requireRole(["admin"]);
  const reason = (alasan ?? "").trim();
  if (reason.length < 3) return { error: "Alasan wajib (min 3 karakter)" };

  const row = await db.query.rekonsiliasiBank.findFirst({
    where: eq(rekonsiliasiBank.id, id),
  });
  if (!row) return { error: "Entri tidak ditemukan" };

  await db.delete(rekonsiliasiBank).where(eq(rekonsiliasiBank.id, id));

  await logAudit({
    actorUserId: session.user.id,
    action: "rekonsiliasi.hapus",
    entity: "rekonsiliasi_bank",
    entityId: id,
    before: {
      tanggal: row.tanggal.toISOString(),
      metode: row.metode,
      omzetSistem: row.omzetSistem,
      saldoAktual: row.saldoAktual,
      selisih: row.selisih,
    },
    meta: { alasan: reason },
  });

  revalidatePath("/admin/rekonsiliasi");
  return { ok: true };
}
