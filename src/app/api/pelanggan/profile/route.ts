import { NextResponse } from "next/server";
import { and, eq, ne, isNull } from "drizzle-orm";
import { db } from "@/db";
import { pelanggan } from "@/db/schema/pelanggan";
import { user as userTable } from "@/db/schema/auth";
import { getSession } from "@/lib/permissions";
import { findPelangganByKode, generateUniqueKodeReferral, ensureKodeReferral } from "@/lib/loyalty";

function normalizeNomorWA(raw: string): string {
  let s = raw.trim().replace(/[\s-]/g, "");
  if (s.startsWith("+")) s = s.slice(1);
  if (s.startsWith("62")) s = "0" + s.slice(2);
  if (s.startsWith("8")) s = "0" + s;
  return s.replace(/\D/g, "");
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json();
  const { nama, telp, alamat, kodeReferral } = body as {
    nama?: string;
    telp?: string;
    alamat?: string;
    kodeReferral?: string;
  };

  // Normalize + sync nomor WA ke user.phoneNumber supaya WA notif jalan.
  // Validasi format Indonesia: 0 + 8-15 digit. Skip kalau kosong.
  let nomor: string | null = null;
  if (telp && telp.trim()) {
    const norm = normalizeNomorWA(telp);
    if (!/^0\d{8,14}$/.test(norm)) {
      return NextResponse.json(
        { error: "Format nomor WA tidak valid. Contoh: 08123456789" },
        { status: 400 },
      );
    }
    // Cek unique exclude diri sendiri
    const dupe = await db.query.user.findFirst({
      where: and(eq(userTable.phoneNumber, norm), ne(userTable.id, session.user.id)),
    });
    if (dupe) {
      return NextResponse.json(
        { error: "Nomor WA sudah dipakai akun lain" },
        { status: 400 },
      );
    }
    nomor = norm;
    await db
      .update(userTable)
      .set({ phoneNumber: norm, updatedAt: new Date() })
      .where(eq(userTable.id, session.user.id));
  }

  const existing = await db.query.pelanggan.findFirst({
    where: eq(pelanggan.userId, session.user.id),
  });

  // Auto-link: kalau belum ada record pelanggan dengan userId user ini,
  // tapi ada record walk-in (userId IS NULL) dengan nomor WA yang sama,
  // hubungkan ke yang existing — supaya history/loyalty yang dibuat
  // kasir tidak hilang.
  let linkedWalkIn = false;
  if (!existing && nomor) {
    const walkIn = await db.query.pelanggan.findFirst({
      where: and(eq(pelanggan.telp, nomor), isNull(pelanggan.userId)),
    });
    if (walkIn) {
      const kode =
        walkIn.kodeReferral ?? (await ensureKodeReferral(walkIn.id));
      await db
        .update(pelanggan)
        .set({
          userId: session.user.id,
          nama: nama ?? walkIn.nama,
          alamat: alamat ?? walkIn.alamat,
          kodeReferral: kode,
          updatedAt: new Date(),
        })
        .where(eq(pelanggan.id, walkIn.id));
      linkedWalkIn = true;
    }
  }

  if (linkedWalkIn) {
    return NextResponse.json({ ok: true, linked: true });
  }

  // Resolve referrer (hanya saat row pelanggan baru dibuat, bukan update)
  let referredBy: number | undefined;
  if (!existing && kodeReferral?.trim()) {
    const refId = await findPelangganByKode(kodeReferral);
    if (refId) referredBy = refId;
  }

  if (existing) {
    await db
      .update(pelanggan)
      .set({ nama: nama ?? existing.nama, telp: nomor ?? existing.telp, alamat, updatedAt: new Date() })
      .where(eq(pelanggan.id, existing.id));
  } else {
    const kode = await generateUniqueKodeReferral();
    await db.insert(pelanggan).values({
      userId: session.user.id,
      nama: nama ?? session.user.name,
      telp: nomor,
      alamat,
      kodeReferral: kode,
      referredBy,
    });
  }

  return NextResponse.json({ ok: true });
}
