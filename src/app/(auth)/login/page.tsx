"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { PasswordInput } from "@/components/PasswordInput";

type DetectedMode = "email" | "phone" | "username";

function detectMode(input: string): DetectedMode {
  const v = input.trim();
  if (!v) return "username";
  if (v.includes("@")) return "email";
  if (/^(\+?\d{8,})$/.test(v) || /^08\d{6,}$/.test(v)) return "phone";
  return "username";
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="text-sm text-[color:var(--muted)]">Memuat...</div>}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/";

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mode = useMemo(() => detectMode(identifier), [identifier]);
  const hint =
    !identifier
      ? "Email, username, atau nomor WhatsApp"
      : mode === "email"
        ? "Login via Email"
        : mode === "phone"
          ? "Login via Nomor WhatsApp (OTP)"
          : "Login via Username";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "email") {
        const { error } = await authClient.signIn.email({
          email: identifier.trim(),
          password,
          callbackURL: next,
        });
        if (error) throw new Error(error.message ?? "Gagal masuk");
        router.push(next);
        router.refresh();
      } else if (mode === "username") {
        const { error } = await authClient.signIn.username({
          username: identifier.trim(),
          password,
        });
        if (error) throw new Error(error.message ?? "Gagal masuk");
        router.push(next);
        router.refresh();
      } else {
        if (!otpSent) {
          const { error } = await authClient.phoneNumber.sendOtp({
            phoneNumber: identifier.trim(),
          });
          if (error) throw new Error(error.message ?? "Gagal kirim OTP");
          setOtpSent(true);
        } else {
          const { error } = await authClient.phoneNumber.verify({
            phoneNumber: identifier.trim(),
            code: otp,
          });
          if (error) throw new Error(error.message ?? "OTP salah / kedaluwarsa");
          router.push(next);
          router.refresh();
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Masuk</h1>
        <p className="text-sm text-[color:var(--muted)]">Selamat datang kembali di Depot Air.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="text-sm font-medium block mb-1">User</label>
          <input
            type="text"
            required
            autoComplete="username"
            value={identifier}
            onChange={(e) => {
              setIdentifier(e.target.value);
              setOtpSent(false);
              setError(null);
            }}
            placeholder="email / username / 08xxxxxxxxxx"
            className="w-full px-3 py-2 border border-line rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <p className="text-xs text-[color:var(--muted)] mt-1">{hint}</p>
        </div>

        {mode !== "phone" && (
          <div>
            <label className="text-sm font-medium block mb-1">Password</label>
            <PasswordInput
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-line rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        )}

        {mode === "phone" && otpSent && (
          <div>
            <label className="text-sm font-medium block mb-1">Kode OTP</label>
            <input
              type="text"
              inputMode="numeric"
              required
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              className="w-full px-3 py-2 border border-line rounded-md tracking-widest text-center"
            />
            <button
              type="button"
              onClick={() => {
                setOtpSent(false);
                setOtp("");
              }}
              className="text-xs text-[color:var(--muted)] mt-1 hover:underline"
            >
              Kirim ulang / ganti nomor
            </button>
          </div>
        )}

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
          {loading
            ? "Memproses..."
            : mode === "phone" && !otpSent
              ? "Kirim OTP"
              : "Masuk"}
        </button>
      </form>

      <p className="text-sm text-center text-[color:var(--muted)]">
        Belum punya akun?{" "}
        <Link href="/register" className="text-brand-600 hover:underline">
          Daftar
        </Link>
      </p>
    </div>
  );
}
