import Link from "next/link";
import { User, Truck } from "lucide-react";
import { LogoutButton } from "../akun/LogoutButton";
import { DropFill } from "@/components/GallonArt";
import { requireRole } from "@/lib/permissions";

export default async function KurirLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole(["admin", "kasir", "kurir"]);
  return (
    <div className="min-h-screen bg-[color:var(--surface2)]">
      <header className="bg-surface border-b border-line sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/kurir" className="inline-flex items-center gap-2">
            <span className="w-9 h-9 rounded-xl bg-brand text-white grid place-items-center">
              <DropFill size={18} color="white" />
            </span>
            <div>
              <div className="font-extrabold leading-tight">DEPOT GNR</div>
              <div className="text-[10px] text-[color:var(--muted)] leading-tight inline-flex items-center gap-1">
                <Truck size={10} /> Mode Kurir
              </div>
            </div>
          </Link>
          <div className="flex items-center gap-2 text-xs text-[color:var(--muted)]">
            <Link
              href="/akun"
              className="inline-flex items-center gap-1 hover:text-ink px-2 py-1 rounded-lg hover:bg-[color:var(--surface2)]"
            >
              <User size={14} /> <span className="hidden sm:inline">{session.user.name}</span>
            </Link>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="max-w-2xl mx-auto p-4 pb-20">{children}</main>
    </div>
  );
}
