"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { requireRole } from "@/lib/permissions";
import { db } from "@/db";
import { kasMasuk } from "@/db/schema/kas-masuk";
import { shiftKasir } from "@/db/schema/shift";
import { getShiftAktif, ringkasanShift } from "@/lib/shift";
import { logAudit } from "@/lib/audit";

async function recomputeIfClosed(shiftId: number): Promise<void> {
  const shift = await db.query.shiftKasir.findFirst({
    where: eq(shiftKasir.id, shiftId),
  });
  if (!shift || shift.status !== "closed") return;
  const ring = await ringkasanShift(shiftId);
  const counted = shift.closingCashCounted ?? 0;
  const selisihBaru = counted - ring.expected;
  const updates: {
    closingCashExpected: number;
    selisih: number;
    selisihKategori?: string | null;
    selisihAlasan?: string | null;
  } = { closingCashExpected: ring.expected, selisih: selisihBaru };
  if (selisihBaru === 0) {
    updates.selisihKategori = null;
    updates.selisihAlasan = null;
  }
  await db.update(shiftKasir).set(updates).where(eq(shiftKasir.id, shiftId));
}

const KATEGORI_VALID = [
  "pelunasan-offline",
  "tip",
  "setoran-titip",
  "kembalian-tidak-diambil",
  "lainnya",
] as const;

type KategoriKasMasuk = (typeof KATEGORI_VALID)[number];

function isKategoriValid(k: string): k is KategoriKasMasuk {
  return (KATEGORI_VALID as readonly string[]).includes(k);
}

export async function tambahKasMasukAction(args: {
  jumlah: number;
  kategori: string;
  deskripsi: string;
  shiftId?: number;
}): Promise<{ ok: true; id: number } | { error: string }> {
  const session = await requireRole(["admin", "kasir"]);

  const jumlah = Math.floor(args.jumlah);
  if (!Number.isFinite(jumlah) || jumlah <= 0) {
    return { error: "Jumlah harus > 0" };
  }
  if (!isKategoriValid(args.kategori)) {
    return { error: "Kategori tidak valid" };
  }
  const deskripsi = (args.deskripsi ?? "").trim();
  if (deskripsi.length < 3) {
    return { error: "Keterangan wajib (min 3 karakter)" };
  }

  let shiftId: number | null = args.shiftId ?? null;
  if (!shiftId) {
    const aktif = await getShiftAktif(session.user.id);
    shiftId = aktif?.id ?? null;
  }
  if (!shiftId) {
    return { error: "Tidak ada shift aktif. Buka shift dulu." };
  }

  const shift = await db.query.shiftKasir.findFirst({
    where: eq(shiftKasir.id, shiftId),
  });
  if (!shift) return { error: "Shift tidak ditemukan" };

  const isAdmin = session.user.role === "admin";
  if (!isAdmin) {
    if (shift.kasirUserId !== session.user.id) {
      return { error: "Hanya kasir pemilik shift atau admin yang bisa tambah" };
    }
    if (shift.status !== "open") {
      return { error: "Shift sudah ditutup. Minta admin untuk koreksi." };
    }
  }

  const now = new Date();
  const inserted = await db
    .insert(kasMasuk)
    .values({
      tanggal: now,
      kategori: args.kategori,
      jumlah,
      deskripsi,
      createdBy: session.user.id,
      shiftId,
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: kasMasuk.id });

  const newId = inserted[0]?.id;
  if (!newId) return { error: "Gagal simpan kas masuk" };

  await recomputeIfClosed(shiftId);

  await logAudit({
    actorUserId: session.user.id,
    action: "kas-masuk.tambah",
    entity: "kas_masuk",
    entityId: newId,
    after: { jumlah, kategori: args.kategori, deskripsi, shiftId },
  });

  revalidatePath("/kasir/shift");
  revalidatePath("/admin/shift");
  return { ok: true, id: newId };
}

export async function hapusKasMasukAction(
  id: number,
  alasan: string,
): Promise<{ ok: true } | { error: string }> {
  const session = await requireRole(["admin", "kasir"]);
  const reason = (alasan ?? "").trim();
  if (reason.length < 3) return { error: "Alasan wajib (min 3 karakter)" };

  const row = await db.query.kasMasuk.findFirst({
    where: eq(kasMasuk.id, id),
  });
  if (!row) return { error: "Entri tidak ditemukan" };

  const shift = await db.query.shiftKasir.findFirst({
    where: eq(shiftKasir.id, row.shiftId),
  });
  if (!shift) return { error: "Shift tidak ditemukan" };

  const isAdmin = session.user.role === "admin";
  if (!isAdmin) {
    if (row.createdBy !== session.user.id) {
      return { error: "Hanya pembuat atau admin yang bisa hapus" };
    }
    if (shift.status !== "open") {
      return { error: "Shift sudah ditutup. Minta admin untuk koreksi." };
    }
  }

  await db.delete(kasMasuk).where(eq(kasMasuk.id, id));
  await recomputeIfClosed(row.shiftId);

  await logAudit({
    actorUserId: session.user.id,
    action: "kas-masuk.hapus",
    entity: "kas_masuk",
    entityId: id,
    before: { jumlah: row.jumlah, kategori: row.kategori, deskripsi: row.deskripsi, shiftId: row.shiftId },
    meta: { alasan: reason },
  });

  revalidatePath("/kasir/shift");
  revalidatePath("/admin/shift");
  return { ok: true };
}
