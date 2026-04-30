import Link from "next/link";
import { DropFill } from "@/components/GallonArt";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-[color:var(--surface2)]">
      <Link href="/" className="inline-flex items-center gap-2 mb-6">
        <span className="w-10 h-10 rounded-2xl bg-brand text-white grid place-items-center">
          <DropFill size={22} color="white" />
        </span>
        <span className="font-extrabold text-lg tracking-tight">DEPOT GNR</span>
      </Link>
      <div className="w-full max-w-md bg-surface rounded-3xl border border-line p-6 shadow-sm">
        {children}
      </div>
    </main>
  );
}
