import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { user as userTable, account as accountTable } from "@/db/schema/auth";
import { pelanggan as pelangganTable } from "@/db/schema/pelanggan";
import { requireSession } from "@/lib/permissions";
import { AkunClient } from "./AkunClient";
import { LogoutButton } from "./LogoutButton";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { DistanceWarning } from "@/components/DistanceWarning";
import { getDepotConfig } from "@/lib/depot-config";
import { ShareRegistrationButton } from "@/components/ShareRegistrationButton";

export const dynamic = "force-dynamic";

export default async function AkunPage() {
  const session = await requireSession();
  const u = await db.query.user.findFirst({ where: eq(userTable.id, session.user.id) });

  const cred = await db.query.account.findFirst({
    where: and(
      eq(accountTable.userId, session.user.id),
      eq(accountTable.providerId, "credential"),
    ),
  });
  const hasPassword = !!cred?.password;

  const role = session.user.role ?? "pelanggan";
  // Alamat hanya relevan untuk pelanggan
  const isPelanggan = role === "pelanggan";
  const pel = isPelanggan
    ? await db.query.pelanggan.findFirst({
        where: eq(pelangganTable.userId, session.user.id),
      })
    : null;
  const depotCfg = isPelanggan ? await getDepotConfig() : null;
  const homeHref =
    role === "admin" ? "/admin/dashboard" : role === "kasir" ? "/kasir/pos" : "/pelanggan/beranda";

  return (
    <div className="min-h-screen bg-[color:var(--surface2)]">
      <header className="bg-surface border-b border-line sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link
            href={homeHref}
            className="inline-flex items-center gap-1.5 text-sm text-[color:var(--muted)] hover:text-ink"
          >
            <ArrowLeft size={16} /> Kembali
          </Link>
          <div className="font-semibold">Akun Saya</div>
          <LogoutButton />
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 space-y-4">
        <div className="bg-surface border border-line rounded-2xl p-4 space-y-2 text-sm">
          <Row label="Nama" value={u?.name ?? "-"} />
          <Row label="Email" value={u?.email ?? "-"} />
          <Row label="Username" value={u?.displayUsername ?? u?.username ?? "-"} />
          <Row label="Nomor WA" value={u?.phoneNumber ?? "-"} />
          <Row label="Role" value={role} />
        </div>

        <ThemeSwitcher />

        {isPelanggan && depotCfg && (
          <DistanceWarning
            pelangganLat={pel?.koordinatLat ?? null}
            pelangganLng={pel?.koordinatLng ?? null}
            depotLat={depotCfg.depotLat}
            depotLng={depotCfg.depotLng}
            maxKm={depotCfg.maxJarakAntarKm}
            kontakWA={depotCfg.kontakWA}
            kontakTelegram={depotCfg.kontakTelegram}
          />
        )}

        <AkunClient
          currentNama={u?.name ?? session.user.name ?? ""}
          currentAlamat={pel?.alamat ?? ""}
          currentNomor={u?.phoneNumber ?? ""}
          currentEmail={u?.email ?? ""}
          currentUsername={u?.displayUsername ?? u?.username ?? null}
          hasPassword={hasPassword}
          showAlamat={isPelanggan}
          currentLat={pel?.koordinatLat ?? null}
          currentLng={pel?.koordinatLng ?? null}
        />

        {/* Staff (admin/kasir/kurir) bisa bagikan link daftar ke pelanggan baru */}
        {!isPelanggan && <ShareRegistrationButton />}
      </main>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-[color:var(--muted)]">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
