"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="text-sm text-slate-500">Memuat...</div>}>
      <RegisterInner />
    </Suspense>
  );
}

function RegisterInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [nama, setNama] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [telp, setTelp] = useState("");
  const [alamat, setAlamat] = useState("");
  const [kodeReferral, setKodeReferral] = useState("");

  useEffect(() => {
    const ref = params.get("ref");
    if (ref) setKodeReferral(ref.toUpperCase());
  }, [params]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error } = await authClient.signUp.email({
        email,
        password,
        name: nama,
      });
      if (error) throw new Error(error.message ?? "Gagal daftar");

      // Simpan profil pelanggan tambahan (telp, alamat, kodeReferral) via API kustom
      await fetch("/api/pelanggan/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nama, telp, alamat, kodeReferral }),
      });

      router.push("/pelanggan/beranda");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Daftar Akun Pelanggan</h1>
        <p className="text-sm text-slate-500">Order air minum jadi lebih mudah.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <Field label="Nama Lengkap" value={nama} onChange={setNama} required />
        <Field label="Email" type="email" value={email} onChange={setEmail} required />
        <Field label="Password" type="password" value={password} onChange={setPassword} required minLength={6} />
        <Field label="Nomor WhatsApp" value={telp} onChange={setTelp} placeholder="08xxxxxxxxxx" />
        <Field
          label="Kode Referral (opsional)"
          value={kodeReferral}
          onChange={(v) => setKodeReferral(v.toUpperCase())}
          placeholder="dari teman yang ajak"
        />
        <div>
          <label className="text-sm font-medium block mb-1">Alamat Pengantaran</label>
          <textarea
            value={alamat}
            onChange={(e) => setAlamat(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-slate-300 rounded-md"
          />
        </div>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 bg-brand-600 text-white font-medium rounded-md hover:bg-brand-700 disabled:opacity-50"
        >
          {loading ? "Mendaftarkan..." : "Daftar"}
        </button>
      </form>

      <p className="text-sm text-center text-slate-600">
        Sudah punya akun?{" "}
        <Link href="/login" className="text-brand-600 hover:underline">
          Masuk
        </Link>
      </p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
  placeholder,
  minLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  minLength?: number;
}) {
  return (
    <div>
      <label className="text-sm font-medium block mb-1">{label}</label>
      <input
        type={type}
        required={required}
        minLength={minLength}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500"
      />
    </div>
  );
}
