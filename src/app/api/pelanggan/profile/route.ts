import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { pelanggan } from "@/db/schema/pelanggan";
import { getSession } from "@/lib/permissions";
import { findPelangganByKode, generateUniqueKodeReferral } from "@/lib/loyalty";

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

  const existing = await db.query.pelanggan.findFirst({
    where: eq(pelanggan.userId, session.user.id),
  });

  // Resolve referrer (hanya saat row pelanggan baru dibuat, bukan update)
  let referredBy: number | undefined;
  if (!existing && kodeReferral?.trim()) {
    const refId = await findPelangganByKode(kodeReferral);
    if (refId) referredBy = refId;
  }

  if (existing) {
    await db
      .update(pelanggan)
      .set({ nama: nama ?? existing.nama, telp, alamat, updatedAt: new Date() })
      .where(eq(pelanggan.id, existing.id));
  } else {
    const kode = await generateUniqueKodeReferral();
    await db.insert(pelanggan).values({
      userId: session.user.id,
      nama: nama ?? session.user.name,
      telp,
      alamat,
      kodeReferral: kode,
      referredBy,
    });
  }

  return NextResponse.json({ ok: true });
}
