"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { requireRole } from "@/lib/permissions";
import { db } from "@/db";
import { pengeluaran } from "@/db/schema/pengeluaran";
import { shiftKasir } from "@/db/schema/shift";
import { ringkasanShift } from "@/lib/shift";
import { logAudit } from "@/lib/audit";

/**
 * Tambah pengeluaran ke shift tertentu (open atau closed) untuk
 * menjelaskan selisih. Auto-recompute selisih kalau shift closed.
 *
 * Akses:
 *  - Admin: bebas
 *  - Kasir: hanya shift open milik sendiri
 */
export async function tambahPengeluaranKeShiftAction(args: {
  shiftId: number;
  jumlah: number;
  kategori: string;
  deskripsi: string;
}): Promise<
  | { ok: true; id: number; recomputed?: { expected: number; selisih: number } }
  | { error: string }
> {
  const session = await requireRole(["admin", "kasir"]);
  const jumlah = Math.floor(args.jumlah);
  if (!Number.isFinite(jumlah) || jumlah <= 0) {
    return { error: "Jumlah harus > 0" };
  }
  const kategori = args.kategori.trim().toLowerCase();
  if (!kategori) return { error: "Kategori wajib" };
  const deskripsi = args.deskripsi.trim();
  if (deskripsi.length < 3) return { error: "Keterangan wajib (min 3 karakter)" };

  const shift = await db.query.shiftKasir.findFirst({
    where: eq(shiftKasir.id, args.shiftId),
  });
  if (!shift) return { error: "Shift tidak ditemukan" };

  const isAdmin = session.user.role === "admin";
  if (!isAdmin) {
    if (shift.kasirUserId !== session.user.id) {
      return { error: "Hanya admin atau kasir pemilik shift yang bisa" };
    }
    if (shift.status !== "open") {
      return { error: "Shift sudah ditutup. Minta admin untuk koreksi." };
    }
  }

  const now = new Date();
  const inserted = await db
    .insert(pengeluaran)
    .values({
      tanggal: now,
      kategori,
      jumlah,
      deskripsi,
      createdBy: session.user.id,
      shiftId: args.shiftId,
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: pengeluaran.id });

  const newId = inserted[0]?.id;
  if (!newId) return { error: "Gagal simpan pengeluaran" };

  // Recompute selisih kalau shift closed
  let recomputed: { expected: number; selisih: number } | undefined;
  if (shift.status === "closed") {
    const ring = await ringkasanShift(args.shiftId);
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
    await db.update(shiftKasir).set(updates).where(eq(shiftKasir.id, args.shiftId));
    recomputed = { expected: ring.expected, selisih: selisihBaru };
  }

  await logAudit({
    actorUserId: session.user.id,
    action: "pengeluaran.tambah-investigasi",
    entity: "pengeluaran",
    entityId: newId,
    after: { jumlah, kategori, deskripsi, shiftId: args.shiftId, ...(recomputed ?? {}) },
    meta: { investigasi: true, shiftStatus: shift.status },
  });

  revalidatePath("/kasir/shift");
  revalidatePath("/admin/shift");
  revalidatePath("/admin/pengeluaran");
  return { ok: true, id: newId, recomputed };
}
