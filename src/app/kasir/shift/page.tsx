import { eq, and, gte, lte, desc } from "drizzle-orm";
import { db } from "@/db";
import { shiftKasir } from "@/db/schema/shift";
import { user as userTable } from "@/db/schema/auth";
import { requireRole } from "@/lib/permissions";
import { getShiftAktif, getSemuaShiftAktif, ringkasanShift, SHIFT_REOPEN_WINDOW_MS } from "@/lib/shift";
import { ShiftClient } from "./ShiftClient";
import { PageHeader } from "@/components/AppShell";

export const dynamic = "force-dynamic";

export default async function ShiftPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const session = await requireRole(["admin", "kasir"]);
  const sp = await searchParams;
  const next = sp.next?.trim() || null;

  const myShiftAktif = await getShiftAktif(session.user.id);
  const semuaShiftAktif = await getSemuaShiftAktif();

  // Shift hari ini milik saya (untuk history harian)
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const shiftHariIniRaw = await db
    .select({
      id: shiftKasir.id,
      openedAt: shiftKasir.openedAt,
      closedAt: shiftKasir.closedAt,
      status: shiftKasir.status,
      openingCash: shiftKasir.openingCash,
      closingCashCounted: shiftKasir.closingCashCounted,
      closingCashExpected: shiftKasir.closingCashExpected,
      selisih: shiftKasir.selisih,
      catatan: shiftKasir.catatan,
      kasirNama: userTable.name,
    })
    .from(shiftKasir)
    .leftJoin(userTable, eq(shiftKasir.kasirUserId, userTable.id))
    .where(
      and(
        eq(shiftKasir.kasirUserId, session.user.id),
        gte(shiftKasir.openedAt, startOfDay),
        lte(shiftKasir.openedAt, endOfDay),
      ),
    )
    .orderBy(desc(shiftKasir.openedAt));

  // Ringkasan untuk shift aktif (kalau ada)
  const ringkasanAktif = myShiftAktif ? await ringkasanShift(myShiftAktif.id) : null;

  return (
    <div className="p-4 md:p-6 max-w-3xl">
      <PageHeader
        title="Shift Kasir"
        description="Buka shift saat mulai kerja, tutup saat selesai. Recap omzet cash + selisih kas otomatis."
      />

      {next && !myShiftAktif && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-3 mb-4">
          <div className="text-sm font-bold text-amber-900">
            ⚠ Buka shift untuk melanjutkan
          </div>
          <div className="text-xs text-amber-800 mt-1">
            Anda diarahkan ke sini karena belum buka shift. Setelah buka shift,
            otomatis kembali ke halaman sebelumnya.
          </div>
        </div>
      )}

      <ShiftClient
        nextUrl={next}
        myShiftAktif={
          myShiftAktif
            ? {
                id: myShiftAktif.id,
                openedAt: myShiftAktif.openedAt.toISOString(),
                openingCash: myShiftAktif.openingCash,
              }
            : null
        }
        ringkasanAktif={ringkasanAktif}
        semuaShiftAktif={semuaShiftAktif
          .filter((s) => s.kasirUserId !== session.user.id)
          .map((s) => ({
            id: s.id,
            kasirNama: s.kasirNama ?? "—",
            openedAt: s.openedAt.toISOString(),
            openingCash: s.openingCash,
          }))}
        shiftHariIni={shiftHariIniRaw.map((s) => ({
          id: s.id,
          openedAt: s.openedAt.toISOString(),
          closedAt: s.closedAt?.toISOString() ?? null,
          status: s.status,
          openingCash: s.openingCash,
          closingCashCounted: s.closingCashCounted,
          closingCashExpected: s.closingCashExpected,
          selisih: s.selisih,
          catatan: s.catatan,
          kasirNama: s.kasirNama ?? "—",
          dapatReopen:
            s.status === "closed" &&
            s.closedAt !== null &&
            Date.now() - s.closedAt.getTime() < SHIFT_REOPEN_WINDOW_MS,
        }))}
      />
    </div>
  );
}
