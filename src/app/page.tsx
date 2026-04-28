import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/permissions";

export default async function Home() {
  const session = await getSession();
  if (session) {
    const role = (session.user as { role?: string }).role ?? "pelanggan";
    if (role === "admin") redirect("/admin/dashboard");
    if (role === "kasir") redirect("/kasir/pos");
    redirect("/pelanggan/beranda");
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-2xl text-center space-y-6">
        <h1 className="text-4xl font-bold text-brand-700">Depot Air Minum Isi Ulang</h1>
        <p className="text-slate-600">
          Aplikasi manajemen depot — POS kasir, order online, inventory galon, integrasi
          Telegram/WhatsApp, dan sinkronisasi Google Sheets.
        </p>
        <div className="flex gap-3 justify-center">
          <Link
            href="/login"
            className="px-5 py-2.5 rounded-md bg-brand-600 text-white hover:bg-brand-700"
          >
            Masuk
          </Link>
          <Link
            href="/register"
            className="px-5 py-2.5 rounded-md border border-brand-600 text-brand-600 hover:bg-brand-50"
          >
            Daftar
          </Link>
        </div>
      </div>
    </main>
  );
}
