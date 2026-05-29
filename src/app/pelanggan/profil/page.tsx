import Link from "next/link";
import { Settings, Gift, ChevronRight, MapPin, AtSign, Phone, Mail, Send, MessageSquareWarning } from "lucide-react";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user as userTable } from "@/db/schema/auth";
import { pengaturan } from "@/db/schema/pengaturan";
import { requireSession } from "@/lib/permissions";
import { getOrCreatePelanggan } from "@/lib/pelanggan";
import { formatRupiah } from "@/lib/utils";
import { ProfilClient } from "./ProfilClient";
import { HubungiAdmin } from "@/components/HubungiAdmin";

export const dynamic = "force-dynamic";

export default async function ProfilPage() {
  const session = await requireSession();
  const pel = await getOrCreatePelanggan(session.user.id, session.user.name);
  const u = await db.query.user.findFirst({ where: eq(userTable.id, session.user.id) });
  const cfgRows = await db.query.pengaturan.findMany();
  const cfg = Object.fromEntries(cfgRows.map((r) => [r.key, r.value ?? ""]));
  void pengaturan;

  const initials = pel.nama
    .split(" ")
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div>
      {/* Avatar header */}
      <div className="bg-surface -mx-4 sm:mx-0 sm:rounded-3xl px-5 pt-5 pb-6 text-center border-b border-line sm:border-0">
        <div className="w-20 h-20 mx-auto rounded-full bg-brand text-white grid place-items-center text-3xl font-extrabold">
          {initials || "?"}
        </div>
        <div className="text-xl font-extrabold mt-3">{pel.nama}</div>
        <div className="text-xs text-[color:var(--muted)] mt-0.5">
          {pel.telp ?? u?.email ?? "Pelanggan DEPOT GNR"}
        </div>
        <Link
          href="/akun"
          className="inline-block mt-3 px-5 py-2 border-2 border-line rounded-full text-xs font-bold hover:border-brand hover:text-brand transition"
        >
          Edit profil & akun
        </Link>
      </div>

      {/* Loyalty card */}
      <Link
        href="/pelanggan/loyalty"
        className="mt-4 flex items-center justify-between bg-gradient-to-br from-[color:var(--brand)] to-[color:var(--brand-deep)] text-white rounded-2xl p-4 hover:opacity-95 transition"
      >
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-white/20 backdrop-blur grid place-items-center">
            <Gift size={20} />
          </div>
          <div>
            <div className="text-[11px] opacity-85 font-semibold">Saldo Loyalty</div>
            <div className="text-xl font-extrabold">{formatRupiah(pel.saldoLoyalti)}</div>
          </div>
        </div>
        <ChevronRight size={20} className="opacity-80" />
      </Link>

      {/* Komplain link */}
      <Link
        href="/pelanggan/komplain"
        className="mt-3 flex items-center justify-between bg-surface border border-line rounded-2xl p-3 hover:border-brand transition"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-50 grid place-items-center">
            <MessageSquareWarning size={16} className="text-amber-600" />
          </div>
          <div>
            <div className="text-sm font-bold">Komplain & Retur</div>
            <div className="text-[11px] text-[color:var(--muted)]">
              Laporkan masalah produk atau order
            </div>
          </div>
        </div>
        <ChevronRight size={16} className="text-[color:var(--muted)]" />
      </Link>

      {/* Hubungi Admin */}
      <div className="mt-4">
        <div className="text-[11px] font-bold tracking-widest text-[color:var(--muted)] mb-2 px-1">
          BANTUAN
        </div>
        <HubungiAdmin kontakWA={cfg.kontakWA} kontakTelegram={cfg.kontakTelegram} />
      </div>

      {/* Info detail */}
      <div className="mt-4">
        <div className="text-[11px] font-bold tracking-widest text-[color:var(--muted)] mb-2 px-1">
          INFORMASI AKUN
        </div>
        <div className="bg-surface border border-line rounded-2xl divide-y divide-line">
          <InfoRow icon={<AtSign size={16} />} label="Username" value={u?.displayUsername ?? u?.username ?? "—"} />
          <InfoRow icon={<Mail size={16} />} label="Email" value={u?.email ?? "—"} />
          <InfoRow icon={<Phone size={16} />} label="Telp / WA" value={pel.telp ?? "—"} />
          <InfoRow icon={<MapPin size={16} />} label="Alamat" value={pel.alamat ?? "—"} />
          <InfoRow
            icon={<Send size={16} />}
            label="Kode Referral"
            value={pel.kodeReferral ?? "—"}
          />
        </div>
      </div>

      {/* Pengaturan akun */}
      <div className="mt-4">
        <div className="text-[11px] font-bold tracking-widest text-[color:var(--muted)] mb-2 px-1">
          PENGATURAN
        </div>
        <Link
          href="/akun"
          className="flex items-center justify-between bg-surface border border-line rounded-2xl p-4 hover:border-brand transition"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[color:var(--surface2)] grid place-items-center">
              <Settings size={18} />
            </div>
            <div>
              <div className="text-sm font-bold">Akun & Tema</div>
              <div className="text-xs text-[color:var(--muted)]">
                Username, password, palet warna
              </div>
            </div>
          </div>
          <ChevronRight size={18} className="text-[color:var(--muted)]" />
        </Link>
      </div>

      {/* Telegram link */}
      <div className="mt-4">
        <div className="text-[11px] font-bold tracking-widest text-[color:var(--muted)] mb-2 px-1">
          NOTIFIKASI TELEGRAM
        </div>
        <ProfilClient
          telegramLinked={!!u?.telegramChatId}
          telegramChatId={u?.telegramChatId ?? null}
        />
      </div>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="w-8 h-8 rounded-lg bg-[color:var(--surface2)] text-[color:var(--muted)] grid place-items-center flex-shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] text-[color:var(--muted)] font-semibold">{label}</div>
        <div className="text-sm font-semibold truncate">{value}</div>
      </div>
    </div>
  );
}
