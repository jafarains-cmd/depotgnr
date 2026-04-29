import Link from "next/link";
import { Truck, User } from "lucide-react";
import { LogoutButton } from "../akun/LogoutButton";
import { requireRole } from "@/lib/permissions";

export default async function KurirLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole(["admin", "kurir"]);
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/kurir" className="font-bold text-brand-700 inline-flex items-center gap-1.5">
            <Truck size={18} /> Kurir
          </Link>
          <div className="flex items-center gap-3 text-xs text-slate-600">
            <Link href="/akun" className="inline-flex items-center gap-1 hover:text-slate-900">
              <User size={14} /> {session.user.name}
            </Link>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="max-w-2xl mx-auto p-4">{children}</main>
    </div>
  );
}
