import Link from "next/link";
import { Settings, Gift } from "lucide-react";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user as userTable } from "@/db/schema/auth";
import { requireSession } from "@/lib/permissions";
import { getOrCreatePelanggan } from "@/lib/pelanggan";
import { formatRupiah } from "@/lib/utils";
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
        <Row label="Username" value={u?.displayUsername ?? u?.username ?? "-"} />
        <Row label="Telp/WA" value={pel.telp ?? "-"} />
        <Row label="Alamat" value={pel.alamat ?? "-"} />
        <Row label="Kode Referral" value={pel.kodeReferral ?? "-"} />
      </div>

      <Link
        href="/pelanggan/loyalty"
        className="flex items-center justify-between bg-gradient-to-br from-brand-50 to-brand-100 border border-brand-200 rounded-xl p-4 hover:from-brand-100"
      >
        <div className="flex items-center gap-3">
          <Gift size={20} className="text-brand-700" />
          <div>
            <div className="text-xs text-brand-700">Saldo Loyalty</div>
            <div className="text-lg font-bold">{formatRupiah(pel.saldoLoyalti)}</div>
          </div>
        </div>
        <span className="text-brand-700 text-sm">Lihat detail ›</span>
      </Link>

      <Link
        href="/akun"
        className="flex items-center justify-between bg-white border border-slate-200 rounded-xl p-4 hover:bg-slate-50"
      >
        <span className="inline-flex items-center gap-2 text-sm font-medium">
          <Settings size={16} /> Pengaturan Akun (username & password)
        </span>
        <span className="text-slate-400">›</span>
      </Link>

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
