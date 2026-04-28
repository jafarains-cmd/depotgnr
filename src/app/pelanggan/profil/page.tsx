import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user as userTable } from "@/db/schema/auth";
import { requireSession } from "@/lib/permissions";
import { getOrCreatePelanggan } from "@/lib/pelanggan";
import { ProfilClient } from "./ProfilClient";

export const dynamic = "force-dynamic";

export default async function ProfilPage() {
  const session = await requireSession();
  const pel = await getOrCreatePelanggan(session.user.id, session.user.name);
  const u = await db.query.user.findFirst({ where: eq(userTable.id, session.user.id) });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Profil</h1>

      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2 text-sm">
        <Row label="Nama" value={pel.nama} />
        <Row label="Email" value={u?.email ?? "-"} />
        <Row label="Telp/WA" value={pel.telp ?? "-"} />
        <Row label="Alamat" value={pel.alamat ?? "-"} />
      </div>

      <ProfilClient
        telegramLinked={!!u?.telegramChatId}
        telegramChatId={u?.telegramChatId ?? null}
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
