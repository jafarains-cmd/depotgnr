import Link from "next/link";

export default function Forbidden() {
  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold">403 — Akses Ditolak</h1>
        <p className="text-slate-600">Akun Anda tidak memiliki izin untuk halaman ini.</p>
        <Link href="/" className="text-brand-600 underline">
          Kembali ke Beranda
        </Link>
      </div>
    </main>
  );
}
