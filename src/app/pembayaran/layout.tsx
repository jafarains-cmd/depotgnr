import Link from "next/link";
import { ArrowLeft, Wallet } from "lucide-react";
import { LogoutButton } from "../akun/LogoutButton";
import { requireRole } from "@/lib/permissions";

export default async function PembayaranLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireRole(["admin", "kasir"]);
  const role = session.user.role;
  const homeHref = role === "admin" ? "/admin/dashboard" : "/kasir/pos";

  return (
    <div className="min-h-screen bg-[color:var(--surface2)]">
      <header className="bg-surface border-b border-line sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link
            href={homeHref}
            className="inline-flex items-center gap-1.5 text-sm text-[color:var(--muted)] hover:text-ink"
          >
            <ArrowLeft size={16} /> Kembali
          </Link>
          <div className="font-extrabold inline-flex items-center gap-1.5">
            <Wallet size={16} className="text-brand" /> Pembayaran
          </div>
          <LogoutButton />
        </div>
      </header>
      <main className="max-w-5xl mx-auto p-4">{children}</main>
    </div>
  );
}
