"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { PasswordInput } from "@/components/PasswordInput";

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="text-sm text-[color:var(--muted)]">Memuat...</div>}>
      <RegisterInner />
    </Suspense>
  );
}

function RegisterInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [nama, setNama] = useState("");
  const [username, setUsername] = useState("");
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

    const usernameTrim = username.trim().toLowerCase();
    if (!/^[a-z0-9_.]{3,30}$/.test(usernameTrim)) {
      setError("Username 3-30 karakter, hanya huruf kecil, angka, titik, underscore.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await authClient.signUp.email({
        email,
        password,
        name: nama,
        username: usernameTrim,
      } as Parameters<typeof authClient.signUp.email>[0]);
      if (error) throw new Error(error.message ?? "Gagal daftar");

      // Simpan profil pelanggan + sync telp ke user.phoneNumber via API kustom
      const res = await fetch("/api/pelanggan/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nama, telp, alamat, kodeReferral }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Gagal simpan profil");
      }

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
        <p className="text-sm text-[color:var(--muted)]">Order air minum jadi lebih mudah.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <Field label="Nama Lengkap" value={nama} onChange={setNama} required />
        <Field
          label="Username"
          value={username}
          onChange={(v) => setUsername(v.toLowerCase())}
          placeholder="3-30 karakter, huruf kecil/angka/_/."
          required
          minLength={3}
        />
        <Field label="Email" type="email" value={email} onChange={setEmail} required />
        <Field label="Password" type="password" value={password} onChange={setPassword} required minLength={6} />
        <Field
          label="Nomor WhatsApp"
          value={telp}
          onChange={setTelp}
          placeholder="08xxxxxxxxxx"
          help="Diisi = otomatis terima notif order via WA"
        />
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
            className="w-full px-3 py-2 border border-line rounded-md"
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

      <p className="text-sm text-center text-[color:var(--muted)]">
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
  help,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  minLength?: number;
  help?: string;
}) {
  const cls = "w-full px-3 py-2 border border-line rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500";
  return (
    <div>
      <label className="text-sm font-medium block mb-1">{label}</label>
      {type === "password" ? (
        <PasswordInput
          required={required}
          minLength={minLength}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={cls}
        />
      ) : (
        <input
          type={type}
          required={required}
          minLength={minLength}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={cls}
        />
      )}
      {help && <p className="text-[11px] text-[color:var(--muted)] mt-1">{help}</p>}
    </div>
  );
}
